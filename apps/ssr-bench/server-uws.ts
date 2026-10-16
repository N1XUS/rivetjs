// UWS-SPIKE shared harness (`dist/server-uws.mjs`, compose `*-uws` static lanes): `server.ts`'s `/page` contract on
// uWebSockets.js instead of `node:http`, identical for every framework (rivet-compiled-uws, solid-stable-static-uws):
// each lane's `renderPage` writes into the same Node `Writable` over a uWS response. Writes collect until the event
// loop turns (as node:http corks them): a page complete by then goes out with a Content-Length in one corked
// `end`, a pending one streams chunked with `onWritable` backpressure. `/health`, `/metrics` as in `server.ts`.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import { Writable } from "node:stream";
import { marked } from "marked";
import { contentServer, textProfile } from "./services/content.server.ts";
import type { Page } from "./services/page-decoder.ts";

interface Adapter {
  renderPage(page: Page, options: { signal: AbortSignal; articleHtml: string }, sink: Writable): Promise<void>;
  close?: () => void;
}
interface UwsResponse {
  writeStatus(status: string): UwsResponse;
  writeHeader(key: string, value: string): UwsResponse;
  write(chunk: Uint8Array): boolean;
  end(body?: Uint8Array | string): UwsResponse;
  close(): UwsResponse;
  cork(cb: () => void): UwsResponse;
  onWritable(handler: (offset: number) => boolean): UwsResponse;
  onAborted(handler: () => void): UwsResponse;
}
interface UwsRequest {
  getUrl(): string;
  getQuery(key: string): string | undefined;
}
interface Uws {
  App(): {
    any(pattern: string, handler: (res: UwsResponse, req: UwsRequest) => void): unknown;
    listen(host: string, port: number, cb: (socket: unknown) => void): unknown;
  };
}

const dist = new URL(import.meta.url.endsWith("/dist/server-uws.mjs") ? "./" : "./dist/", import.meta.url);
const framework = process.env.FRAMEWORK ?? "rivet-compiled";
if (!["rivet-compiled", "solid-stable-static", "solid-stable", "solid-stable-interactive"].includes(framework)) throw new Error("Invalid framework");
const { renderPage, close: closeAdapter } = (await import(new URL(`${framework}.mjs`, dist).href)) as Adapter;
const service = contentServer(process.env.GRPC_URL ?? "127.0.0.1:18100");
const metadata = (
  JSON.parse(await readFile(new URL("builds.json", dist), "utf8")) as {
    artifacts: { framework: string; version: string; implementation: string; outputMode: string }[];
  }
).artifacts.find((a) => a.framework === framework)!;
const counters = { completed: 0, failed: 0, cancelled: 0, rpcMs: 0, parseMs: 0, renderMs: 0 };
// CommonJS entry: the package's ESM wrapper (v20.71.0) imports a missing `./index.js`.
const uws = createRequire(import.meta.url)("uWebSockets.js") as Uws;

interface Exchange {
  aborted: boolean;
  ended: boolean;
  /** Status line + headers out (streaming). */
  started: boolean;
  writable: (() => void) | null;
}
const simple = (res: UwsResponse, ex: Exchange, status: string, body: string, type?: string) => {
  if (ex.aborted) return;
  ex.ended = true;
  res.cork(() => {
    res.writeStatus(status);
    if (type) res.writeHeader("Content-Type", type);
    res.end(body);
  });
};

/** The page sink: collects until the loop turns (copies: the renderer reuses its slabs), then streams. */
function pageSink(res: UwsResponse, ex: Exchange): Writable {
  let collected: Buffer[] | null = [];
  let size = 0;
  const head = () => res.writeStatus("200 OK").writeHeader("Content-Type", "text/html; charset=utf-8").writeHeader("Cache-Control", "no-store");
  setImmediate(() => {
    if (!collected || ex.aborted) return;
    const chunks = collected;
    collected = null;
    ex.started = true;
    res.cork(() => {
      head();
      for (const chunk of chunks) res.write(chunk);
    });
  });
  return new Writable({
    write(chunk: Buffer, _encoding, callback) {
      if (ex.aborted) return callback(new Error("Response aborted"));
      if (collected) {
        collected.push(Buffer.from(chunk));
        size += chunk.length;
        return callback();
      }
      let ok = true;
      res.cork(() => (ok = res.write(chunk)));
      if (ok) callback();
      else ex.writable = () => (ex.aborted ? callback(new Error("Response aborted")) : callback());
    },
    final(callback) {
      if (ex.aborted) return callback(new Error("Response aborted"));
      ex.ended = true;
      if (collected) {
        const chunks = collected;
        collected = null;
        res.cork(() => {
          head();
          res.end(chunks.length === 1 ? chunks[0]! : Buffer.concat(chunks, size));
        });
      } else res.cork(() => res.end());
      callback();
    },
  });
}

const app = uws.App();
app.any("/*", (res, req) => {
  const ex: Exchange = { aborted: false, ended: false, started: false, writable: null };
  const controller = new AbortController();
  res.onAborted(() => {
    ex.aborted = true;
    if (!ex.ended) controller.abort();
    const wake = ex.writable;
    ex.writable = null;
    wake?.();
  });
  res.onWritable(() => {
    const wake = ex.writable;
    ex.writable = null;
    wake?.();
    return true;
  });
  const pathname = req.getUrl();
  if (pathname === "/health" || pathname === "/metrics") {
    const runtime = `node ${process.version} + uWebSockets.js`;
    return simple(
      res,
      ex,
      "200 OK",
      JSON.stringify(
        pathname === "/health"
          ? {
              status: "ready",
              framework,
              version: metadata.version,
              runtime,
              variant: framework === "solid-stable-static" ? "string" : "stream",
              implementation: metadata.implementation,
              outputMode: metadata.outputMode,
            }
          : { ...counters, ...process.memoryUsage() },
      ),
      "application/json",
    );
  }
  if (pathname !== "/page") return simple(res, ex, "404 Not Found", "");
  const rows = Number(req.getQuery("rows") ?? 100);
  const delayMs = Number(req.getQuery("delay_ms") ?? 0);
  const token = req.getQuery("token") ?? "";
  const article = req.getQuery("article") === "1";
  const strings = textProfile(req.getQuery("strings") ?? null);
  if (!Number.isInteger(rows) || rows < 0 || rows > 5000 || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 5000 || token.length > 512)
    return simple(res, ex, "400 Bad Request", "");
  void (async () => {
    try {
      let start = performance.now();
      const page = await service.getPage({ rows, token, article, delayMs, strings }, { signal: controller.signal });
      counters.rpcMs += performance.now() - start;
      start = performance.now();
      const articleHtml = page.markdown ? marked.parse(page.markdown, { async: false }) : "";
      counters.parseMs += performance.now() - start;
      if (ex.aborted) throw new Error("Response aborted");
      const sink = pageSink(res, ex);
      start = performance.now();
      await renderPage(page, { signal: controller.signal, articleHtml }, sink);
      counters.renderMs += performance.now() - start;
      await new Promise<void>((resolve, reject) => sink.end("<!--complete-->", (error?: Error | null) => (error ? reject(error) : resolve())));
      counters.completed++;
    } catch (error) {
      if (controller.signal.aborted || ex.aborted) counters.cancelled++;
      else {
        counters.failed++;
        console.error(error);
        if (ex.ended) return;
        if (!ex.started) simple(res, ex, "502 Bad Gateway", "SSR/backend failure");
        else {
          ex.ended = true;
          res.cork(() => res.close());
        }
      }
    }
  })();
});
app.listen("0.0.0.0", Number(process.env.PORT ?? 8080), (socket) => {
  if (!socket) throw new Error("uWS: listen failed");
  console.log(`SSR ${framework} (uWebSockets.js) listening`);
});
for (const name of ["SIGINT", "SIGTERM"] as const)
  process.on(name, () => {
    closeAdapter?.();
    service.close();
    process.exit(0);
  });
