// EXPERIMENTAL (UWS-SPIKE 2026-10-09, not a public subpath): the node adapter's page semantics over
// uWebSockets.js (https://github.com/uNetworking/uWebSockets.js, native HTTP/1.1 in C++) instead of
// `node:http`. Rendering stays in V8; only the transport changes. Same as `node.ts`: status + headers
// after the handler resolved (loaders decide them), a body complete before the event loop turns goes
// out with a Content-Length in one corked write (compressed in one call), a pending one streams
// (chunked) with backpressure (`onWritable`), aborted requests abort `request.signal` and end the
// render. Gaps vs `node.ts` (prototype): no trustProxy / forwarded headers, no static ranges /
// conditional GETs / precompressed siblings, no `idleMemory`. uWebSockets.js is not a dependency of
// @rivetjs/router: pass the module (`uws`) or have `uWebSockets.js` resolvable (require) from this file.
import { STATUS_CODES } from "node:http";
import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { brotliCompressSync, constants as zlib, createBrotliCompress, createGzip, gzipSync } from "node:zlib";
import type { Transform } from "node:stream";
import { nonce } from "../shared/nonce.ts";
import { DIRECT_BODY, type BodySink, type DirectBody } from "../server/body.ts";
import { negotiate, type Handler, type RequestContext } from "./node.ts";

/** The subset of uWebSockets.js this adapter uses (its own typings are not a dependency). */
interface UwsResponse {
  writeStatus(status: string): UwsResponse;
  writeHeader(key: string, value: string): UwsResponse;
  write(chunk: Uint8Array | string): boolean;
  end(body?: Uint8Array | string, closeConnection?: boolean): UwsResponse;
  endWithoutBody(reportedContentLength?: number, closeConnection?: boolean): UwsResponse;
  close(): UwsResponse;
  cork(cb: () => void): UwsResponse;
  onWritable(handler: (offset: number) => boolean): UwsResponse;
  onAborted(handler: () => void): UwsResponse;
  onData(handler: (chunk: ArrayBuffer, isLast: boolean) => void): UwsResponse;
  getRemoteAddressAsText(): ArrayBuffer;
}
interface UwsRequest {
  getUrl(): string;
  getQuery(): string;
  getCaseSensitiveMethod(): string;
  getHeader(lowerCaseKey: string): string;
  forEach(cb: (key: string, value: string) => void): void;
}
interface UwsApp {
  any(pattern: string, handler: (res: UwsResponse, req: UwsRequest) => void): UwsApp;
  listen(host: string, port: number, cb: (socket: unknown) => void): UwsApp;
  close?(): UwsApp;
}
export interface UwsModule {
  App(options?: object): UwsApp;
  us_listen_socket_close(socket: unknown): void;
  us_socket_local_port(socket: unknown): number;
}

export interface UwsServeOptions {
  handler: Handler;
  /** The uWebSockets.js module; default `require("uWebSockets.js")` resolved from this file. */
  uws?: UwsModule;
  /** Built client directory served before the handler (indexed and read into memory at start). */
  client?: string;
  /** URL base path; client files under it. */
  base?: string;
  port?: number;
  host?: string;
  /** Compress responses by `Accept-Encoding` (default true). */
  compress?: boolean;
  /** Fixed public origin for request URLs (default `http://<Host>`). */
  origin?: string;
  /** Extra headers on every response; defaults add nosniff + referrer policy. */
  headers?: Record<string, string>;
  /** Milliseconds to drain in-flight requests on close (default 10000). */
  grace?: number;
  onError?: (error: unknown, request?: Request) => void;
}
export interface UwsServing {
  readonly url: string;
  close(): Promise<void>;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};
const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml|manifest\+json|wasm)|image\/svg\+xml)/;
const MIN_COMPRESS = 1024;
const HTML_BROTLI = { [zlib.BROTLI_PARAM_QUALITY]: 4, [zlib.BROTLI_PARAM_MODE]: zlib.BROTLI_MODE_TEXT };
const HOST = /^(?:[a-z\d](?:[a-z\d_-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d_-]*[a-z\d])?)*\.?|\[[\da-f:.]+\])(?::\d{1,5})?$/i;
type Encoding = "br" | "gzip" | null;
const statusLine = new Map<number, string>();
const status = (code: number, text?: string): string => {
  if (text) return code + " " + text;
  let line = statusLine.get(code);
  if (!line) statusLine.set(code, (line = code + " " + (STATUS_CODES[code] ?? "Unknown")));
  return line;
};
const decoder = new TextDecoder();

/** One live response: the uWS handle plus its abort state (uWS forbids touching an aborted response). */
interface Exchange {
  readonly res: UwsResponse;
  aborted: boolean;
  ended: boolean;
  /** Status line + headers written. */
  sent: boolean;
  /** Resolvers waiting for `onWritable`. */
  writable: (() => void) | null;
  onAbort: (() => void) | null;
}

function writeHead(ex: Exchange, code: number, text: string | undefined, headers: Record<string, string | string[]>): void {
  const res = ex.res;
  ex.sent = true;
  res.writeStatus(status(code, text));
  for (const name in headers) {
    const value = headers[name]!;
    if (typeof value === "string") res.writeHeader(name, value);
    else for (const one of value) res.writeHeader(name, one);
  }
}

function concat(chunks: Uint8Array[], size: number): Uint8Array {
  if (chunks.length === 1) return chunks[0]!;
  const out = Buffer.allocUnsafe(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** Index a client directory once (dot-named entries skipped) and keep the bytes in memory. */
function indexFiles(client: string): Map<string, { type: string; bytes: Buffer }> {
  const out = new Map<string, { type: string; bytes: Buffer }>();
  const walk = (dir: string, key: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const path = join(dir, entry.name);
      const name = key + "/" + entry.name;
      if (entry.isDirectory()) walk(path, name);
      else if (entry.isFile() && statSync(path).size < 8 * 1024 * 1024)
        out.set(name, { type: MIME[extname(entry.name).toLowerCase()] ?? "application/octet-stream", bytes: readFileSync(path) });
    }
  };
  walk(resolve(client), "");
  return out;
}

/** Serve a web handler over uWebSockets.js. Resolves once listening. */
export async function serveUws(options: UwsServeOptions): Promise<UwsServing> {
  // CommonJS entry: the package's ESM wrapper (v20.71.0) imports a missing `./index.js`.
  const uws = options.uws ?? (createRequire(import.meta.url)("uWebSockets.js") as UwsModule);
  const { handler, compress = true, onError = (error: unknown) => console.error(error) } = options;
  const prefix = options.base && options.base !== "/" ? options.base.replace(/\/$/, "") : "";
  const base: Record<string, string> = { "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin" };
  for (const [name, value] of Object.entries(options.headers ?? {})) base[name.toLowerCase()] = value;
  const fixedOrigin = options.origin ? new URL(options.origin).origin : null;
  const files = options.client ? indexFiles(options.client) : null;
  let draining = false,
    inflight = 0,
    wake: (() => void) | null = null;
  const finished = (ex: Exchange) => {
    if (ex.ended) return;
    ex.ended = true;
    if (--inflight === 0 && wake) wake();
  };
  const plain = (ex: Exchange, code: number, body: string, extra?: Record<string, string>) => {
    if (ex.aborted || ex.ended) return;
    ex.res.cork(() => {
      writeHead(ex, code, undefined, { ...base, "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", ...extra });
      ex.res.end(body);
    });
  };

  /** Wait for the socket to drain (uWS buffered the bytes already: write never drops data). */
  const drained = (ex: Exchange) =>
    new Promise<void>((done, fail) => {
      if (ex.aborted) return fail(new Error("Response stream closed"));
      ex.writable = done;
      ex.onAbort = () => fail(new Error("Response stream closed"));
    });

  /** Whole body: one corked write of status, headers and body (Content-Length), compressed in one call. */
  const sendWhole = (ex: Exchange, response: Response, headers: Record<string, string | string[]>, encoding: Encoding, vary: () => void, body: Uint8Array) => {
    if (ex.aborted) return;
    if (encoding) vary();
    if (encoding && body.length >= MIN_COMPRESS) {
      body =
        encoding === "br" ? brotliCompressSync(body, { params: { ...HTML_BROTLI, [zlib.BROTLI_PARAM_SIZE_HINT]: body.length } }) : gzipSync(body, { level: 6 });
      headers["content-encoding"] = encoding;
    }
    ex.res.cork(() => {
      writeHead(ex, response.status, response.statusText || undefined, headers);
      ex.res.end(body);
    });
    finished(ex);
  };

  /**
   * Streamed body: headers now, chunks as they come (chunked). Uncompressed: uWS copies each chunk on `write`
   * (its view is released at once) and buffers what the socket does not take — after a `false` the writer
   * waits for `onWritable`. Compressed: the Transform reads a chunk after `write` returns, so the chunk's
   * `done` runs from the Transform's write callback; when uWS reports backpressure the compressor's output
   * pauses until `onWritable`, its input then fills and `write` returns false → the writer waits for `drain`.
   */
  const startStream = (ex: Exchange, response: Response, headers: Record<string, string | string[]>, encoding: Encoding, vary: () => void) => {
    delete headers["content-length"];
    if (encoding) {
      headers["content-encoding"] = encoding;
      vary();
    }
    const send = (bytes: Uint8Array): boolean => {
      let ok = true;
      ex.res.cork(() => (ok = ex.res.write(bytes)));
      return ok;
    };
    const closed = () => new Error("Response stream closed");
    let packer: Transform | null = null;
    if (encoding) {
      const out = (packer =
        encoding === "br"
          ? createBrotliCompress({ flush: zlib.BROTLI_OPERATION_FLUSH, params: HTML_BROTLI })
          : createGzip({ flush: zlib.Z_SYNC_FLUSH, level: 6 }));
      out.on("data", (bytes: Buffer) => {
        if (ex.aborted || ex.ended) return;
        if (!send(bytes)) {
          out.pause();
          ex.writable = () => out.resume();
        }
      });
      out.on("end", () => {
        if (!ex.aborted && !ex.ended) ex.res.cork(() => ex.res.end());
        finished(ex);
      });
      out.on("error", () => {
        if (!ex.aborted && !ex.ended) ex.res.cork(() => ex.res.close());
        finished(ex);
      });
      // Client gone: destroying the Transform runs every pending write callback (the chunks' `done`).
      ex.onAbort = () => out.destroy();
    }
    ex.res.cork(() => writeHead(ex, response.status, response.statusText || undefined, headers));
    return {
      write: (chunk: Uint8Array, done?: () => void): Promise<void> | undefined => {
        if (ex.aborted || ex.ended || packer?.destroyed) {
          done?.();
          throw closed();
        }
        if (!packer) {
          const ok = send(chunk);
          done?.();
          return ok ? undefined : drained(ex);
        }
        const out = packer;
        if (out.write(chunk, () => done?.())) return;
        return new Promise<void>((resolve, reject) => {
          const settle = (error?: Error) => {
            out.off("drain", drain);
            out.off("close", gone);
            error ? reject(error) : resolve();
          };
          const drain = () => settle();
          const gone = () => settle(closed());
          out.once("drain", drain);
          out.once("close", gone);
        });
      },
      end: () => {
        if (ex.aborted || ex.ended) return;
        if (packer) packer.end();
        else {
          ex.res.cork(() => ex.res.end());
          finished(ex);
        }
      },
    };
  };

  /** Rendered pages: the renderer's slab views straight into uWS (copied by uWS on write: released at once). */
  const sendDirect = (
    ex: Exchange,
    attach: DirectBody,
    response: Response,
    headers: Record<string, string | string[]>,
    encoding: Encoding,
    vary: () => void,
  ): Promise<void> | null => {
    let collected: Uint8Array[] | null = [];
    let releases: (() => void)[] = [];
    let size = 0;
    let stream: ReturnType<typeof startStream> | null = null;
    let settle!: () => void, failed!: (error: unknown) => void;
    const result = new Promise<void>((done, fail) => ((settle = done), (failed = fail)));
    const release = () => {
      const pending = releases;
      releases = [];
      for (const done of pending) done();
    };
    const sink: BodySink = {
      write(chunk, done) {
        if (ex.aborted) throw new Error("Response stream closed");
        if (collected) {
          collected.push(chunk);
          releases.push(done);
          size += chunk.length;
          return;
        }
        return stream!.write(chunk, done);
      },
      end() {
        if (ex.aborted) return settle();
        if (collected) {
          const chunks = collected;
          collected = null;
          sendWhole(ex, response, headers, encoding, vary, concat(chunks, size));
          release();
        } else stream!.end();
        settle();
      },
      error(error) {
        collected = null;
        release();
        failed(error);
      },
    };
    if (!attach(sink)) return null;
    if (collected)
      setImmediate(() => {
        if (!collected) return;
        if (ex.aborted) {
          collected = null;
          release();
          return;
        }
        stream = startStream(ex, response, headers, encoding, vary);
        const chunks = collected,
          dones = releases;
        collected = null;
        releases = [];
        // Backpressure here is uWS's buffer (it took every byte); the renderer sees it on its next write.
        for (let i = 0; i < chunks.length; i++) {
          try {
            stream.write(chunks[i]!, dones[i])?.catch(() => {});
          } catch {
            // Aborted meanwhile: `write` released the chunk; release the rest.
            for (let j = i + 1; j < chunks.length; j++) dones[j]!();
            return;
          }
        }
      });
    return result;
  };

  const serveResponse = async (ex: Exchange, response: Response, request: Request, method: string, accept: string): Promise<void> => {
    const headers: Record<string, string | string[]> = {};
    for (const name in base) if (!response.headers.has(name)) headers[name] = base[name]!;
    response.headers.forEach((value, name) => {
      if (name !== "set-cookie") headers[name] = value;
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) headers["set-cookie"] = cookies;
    // uWS writes Content-Length / Transfer-Encoding itself.
    delete headers["content-length"];
    const type = response.headers.get("content-type") ?? "";
    const body = response.body;
    // Experimental transport: brotli / gzip only (`negotiate(…, false)` never picks zstd).
    const picked = compress && body && !response.headers.has("content-encoding") && COMPRESSIBLE.test(type) ? negotiate(accept, false) : null;
    const encoding: Encoding = picked === "zstd" ? null : picked;
    const vary = () => (headers.vary = response.headers.has("vary") ? response.headers.get("vary") + ", Accept-Encoding" : "Accept-Encoding");
    if (!body || method === "HEAD") {
      if (encoding) vary();
      await body?.cancel().catch(() => {});
      if (ex.aborted) return;
      ex.res.cork(() => {
        writeHead(ex, response.status, response.statusText || undefined, headers);
        ex.res.endWithoutBody(method === "HEAD" ? Number(response.headers.get("content-length") ?? 0) : 0);
      });
      finished(ex);
      return;
    }
    const direct = (response as { [DIRECT_BODY]?: DirectBody })[DIRECT_BODY];
    const sent = direct && !body.locked ? sendDirect(ex, direct, response, headers, encoding, vary) : null;
    if (sent) return sent;
    // Web stream body: collect until the loop turns (Content-Length), else stream.
    const reader = body.getReader();
    const cancel = () => void reader.cancel(request.signal.reason).catch(() => {});
    request.signal.addEventListener("abort", cancel, { once: true });
    const chunks: Uint8Array[] = [];
    let size = 0,
      turned = false;
    const turn = new Promise<null>((done) => setImmediate(() => ((turned = true), done(null))));
    let pending: Promise<ReadableStreamReadResult<Uint8Array>> | null = reader.read();
    for (;;) {
      const next = turned ? null : await Promise.race([pending!, turn]);
      if (next === null) break;
      if (next.done) {
        pending = null;
        break;
      }
      chunks.push(next.value);
      size += next.value.length;
      pending = reader.read();
    }
    if (!pending) {
      request.signal.removeEventListener("abort", cancel);
      return sendWhole(ex, response, headers, encoding, vary, concat(chunks, size));
    }
    if (ex.aborted) return;
    const out = startStream(ex, response, headers, encoding, vary);
    try {
      for (const chunk of chunks) await out.write(chunk);
      for (let next = await pending; !next.done; next = await reader.read()) await out.write(next.value);
      out.end();
    } finally {
      request.signal.removeEventListener("abort", cancel);
    }
  };

  const app = uws.App();
  app.any("/*", (res, req) => {
    // uWS request data is stack-allocated: read everything before the first await.
    const ex: Exchange = { res, aborted: false, ended: false, sent: false, writable: null, onAbort: null };
    const controller = new AbortController();
    res.onAborted(() => {
      ex.aborted = true;
      ex.onAbort?.();
      if (!ex.ended) controller.abort(new Error("Client disconnected"));
      finished(ex);
    });
    res.onWritable(() => {
      const done = ex.writable;
      ex.writable = null;
      done?.();
      return true;
    });
    inflight++;
    const method = req.getCaseSensitiveMethod();
    const pathname = req.getUrl();
    const query = req.getQuery();
    const host = req.getHeader("host");
    const accept = req.getHeader("accept-encoding");
    let origin = fixedOrigin;
    if (!origin) {
      if (host && !HOST.test(host)) return (plain(ex, 400, "Bad Request: malformed Host", { connection: "close" }), finished(ex));
      origin = "http://" + (host || "localhost");
    }
    if (pathname === "/healthz") return (plain(ex, 200, "ok"), finished(ex));
    if (pathname === "/readyz") return (plain(ex, draining ? 503 : 200, draining ? "draining" : "ready"), finished(ex));
    if (files && (method === "GET" || method === "HEAD") && (!prefix || pathname.startsWith(prefix + "/"))) {
      let key: string | null = null;
      try {
        key = decodeURIComponent(pathname.slice(prefix.length));
      } catch {}
      const file = key && !key.includes("\0") ? files.get(key) : undefined;
      if (file) {
        res.cork(() => {
          writeHead(ex, 200, undefined, {
            ...base,
            "content-type": file.type,
            "cache-control": pathname.startsWith(prefix + "/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
          });
          if (method === "HEAD") res.endWithoutBody(file.bytes.length);
          else res.end(file.bytes);
        });
        return finished(ex);
      }
    }
    const headers = new Headers();
    req.forEach((name, value) => headers.append(name, value));
    const address = decoder.decode(res.getRemoteAddressAsText());
    let body: ReadableStream<Uint8Array> | null = null;
    if (method !== "GET" && method !== "HEAD") {
      let push!: ReadableStreamDefaultController<Uint8Array>;
      body = new ReadableStream<Uint8Array>({ start: (c) => void (push = c) });
      res.onData((chunk, last) => {
        // uWS neuters the ArrayBuffer on return: copy.
        if (chunk.byteLength) push.enqueue(new Uint8Array(chunk.slice(0)));
        if (last) push.close();
      });
    }
    const init: RequestInit & { duplex?: "half" } = { method, headers, signal: controller.signal };
    if (body) {
      init.body = body;
      init.duplex = "half";
    }
    const request = new Request(origin + pathname + (query ? "?" + query : ""), init);
    const context: RequestContext = { nonce: nonce(), ...(address ? { address } : {}) };
    void (async () => {
      try {
        const response = await handler(request, context);
        if (ex.aborted) {
          await response.body?.cancel().catch(() => {});
          return;
        }
        await serveResponse(ex, response, request, method, accept);
      } catch (error) {
        if (ex.aborted || request.signal.aborted) return;
        try {
          onError(error, request);
        } catch (failure) {
          console.error(failure);
        }
        if (ex.ended) return;
        if (!ex.sent) plain(ex, 500, "Internal Server Error");
        // Headers are out already (streamed): close the connection, as node destroys the socket.
        else ex.res.cork(() => ex.res.close());
        finished(ex);
      }
    })();
  });
  const listenSocket = await new Promise<unknown>((done, fail) =>
    app.listen(options.host ?? "127.0.0.1", options.port ?? 3000, (socket) => (socket ? done(socket) : fail(new Error("uWS: listen failed")))),
  );
  const port = uws.us_socket_local_port(listenSocket);
  let closing: Promise<void> | null = null;
  return {
    url: `http://${options.host ?? "127.0.0.1"}:${port}`,
    close: () =>
      (closing ??= (async () => {
        draining = true;
        uws.us_listen_socket_close(listenSocket);
        const grace = new Promise<void>((done) => setTimeout(done, options.grace ?? 10_000).unref());
        await Promise.race([inflight === 0 ? Promise.resolve() : new Promise<void>((done) => (wake = done)), grace]);
        app.close?.();
      })()),
  };
}
