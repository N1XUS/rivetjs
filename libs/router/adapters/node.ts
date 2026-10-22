// Node HTTP adapter: serves built client assets and streams a web-standard handler's Responses.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createReadStream, readdirSync, realpathSync, statSync } from "node:fs";
import { readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import type { AddressInfo, Socket } from "node:net";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { Readable, Transform, type Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  brotliCompress,
  brotliCompressSync,
  constants as zlib,
  createBrotliCompress,
  createGzip,
  createZstdCompress,
  gzip,
  gzipSync,
  zstdCompress,
  zstdCompressSync,
} from "node:zlib";
import { promisify } from "node:util";
import { availableParallelism } from "node:os";
import { loadBuild } from "./build.ts";
import { negotiate, type Encoding } from "./files.ts";
import {
  buildDictionary,
  dczBest,
  dczOnce,
  dczStream,
  dictionaryEntry,
  dictionaryFor,
  dictionaryLink,
  dictionaryOf,
  dictionaryRegistry,
  readDictionaries,
  varyDictionary,
  type Dictionary,
  type DictionaryRegistry,
} from "./dictionary.ts";
import type { BodyLimit } from "../server/security.ts";
import type { ErrorInfo } from "../server/handler.ts";
import type { AppConfig } from "../server/app.ts";
import { normalizeBase } from "../shared/base.ts";
import { nonce } from "../shared/nonce.ts";
import { DATA_PARAM } from "../shared/data.ts";
import { DIRECT_BODY, type BodySink, type DirectBody } from "../server/body.ts";
import { idleMemory, idleMemorySupported } from "./idle-memory.ts";
import type { CachedPage, CacheLookup } from "../server/route-cache.ts";

// `server/route-cache.ts` `ROUTE_CACHE` (registered symbol: that module loads only in apps with route rules).
const ROUTE_CACHE = Symbol.for("rivet.routeCache");
// `server/early-hints.ts` `EARLY_HINTS`: the app calls it (`createApp({ earlyHints })`) before guards and loaders.
const EARLY_HINTS = Symbol.for("rivet.earlyHints");
// `serve({ dictionary: { samples } })`: the registry built at start, handed to `createListener` on its options.
const SAMPLED = Symbol("rivet.dictionary.sampled");

/**
 * Per-request context passed to the handler. It never carries `locals`: the adapter fills nothing from request
 * headers, query or body. A handler that renders with its own data forwards `{ ...context, locals }` to the app.
 */
export interface RequestContext {
  /** Fresh CSP nonce (base64) for inline scripts the handler emits. */
  readonly nonce: string;
  /** Client address, when known. */
  readonly address?: string;
}
/** A request handler (web `Request` → `Response`) served by the Node adapter. */
export type Handler = (request: Request, context: RequestContext) => Response | Promise<Response>;
/** `serve({ compress })` as an object: which codecs and whether immutable files' compressed copies are written to disk. */
export interface CompressOptions {
  /** Offer `zstd` (default true). `false`: brotli / gzip only. */
  zstd?: boolean;
  /** Write immutable files' compressed copies next to them on their first request (default true). */
  precompress?: boolean;
}
/** `serve({ dictionary })` as an object: a compression dictionary built at start from sample pages (server mode). */
export interface DictionaryOptions {
  /**
   * Paths (with query) rendered once through the handler when the server starts — each page and its client-navigation
   * data answer (`?_rivet=data`) — whose shared segments become the site's dictionary (`match="<base>/*"`). Pick pages
   * that stand for the site (one or two per route group); deterministic pages give every worker the same dictionary.
   */
  samples?: readonly string[];
  /** Byte cap of the dictionary (default 131072). */
  max?: number;
}
/** Options of `serve()`. */
export interface ServeOptions {
  handler: Handler;
  /** Built client directory served before the handler (e.g. `dist/client`). */
  client?: string;
  /** Paths (URL pathname) whose files are content-hashed: `Cache-Control: immutable`. Default: `<base>/assets/`. */
  immutable?: (pathname: string) => boolean;
  /** URL base path (`/app`): client files are served under it (`/app/assets/x.js` → `<client>/assets/x.js`); other paths reach the handler. */
  base?: string;
  port?: number;
  host?: string;
  /**
   * How `client` files are found. Default `"index"`: the directory is indexed once at start (real
   * paths, sizes, precompressed `.br`/`.gz` siblings), so page requests cost a map lookup; files added
   * later are not served. `"fs"`: look each GET up on disk (a directory that changes while serving).
   */
  static?: "index" | "fs";
  /**
   * Compress responses by `Accept-Encoding` (default true): `zstd` when the client accepts it (level 1 for bodies of
   * 256 KiB and more, 3 below; streamed bodies by what is collected when streaming starts), else brotli (q4), else gzip
   * (6). Immutable `client` files are precompressed once per file at the best quality (brotli q11, zstd 19, gzip 9) on
   * their first request and written next to the file (`.br` / `.zst` / `.gz`, hidden temp + rename; a read-only
   * directory keeps them in memory only), so the next process start serves them from disk; build-time siblings are
   * used as they are. `{ zstd: false }`: brotli / gzip only (no zstd work at all); `{ precompress: false }`: nothing
   * written to disk. `false`: no compression (a proxy that compresses).
   */
  compress?: boolean | CompressOptions;
  /**
   * Compression Dictionary Transport (RFC 9842; Chromium 130+): HTML pages announce a dictionary (`Link: <…>;
   * rel="compression-dictionary"`, fetched by the browser at idle, served with `Use-As-Dictionary` and a year of
   * `max-age`), and requests whose `Available-Dictionary` names it get `dcz` answers (zstd with the dictionary) —
   * documents, navigation data, any compressible response under the dictionary's path; `Vary: Accept-Encoding,
   * Available-Dictionary`. Default: the `client` build's dictionaries (`.vite/rivet-dictionaries.json`, written by the
   * static adapter's prerender) when `compress` is on. `{ samples }`: build the site's dictionary at start from sample
   * pages (server mode). `false`: none.
   */
  dictionary?: false | DictionaryOptions;
  /**
   * Send `103 Early Hints` when the app asks (`createApp({ earlyHints })`; `start({ earlyHints })` sets both), to
   * HTTP/1.1 clients only (1xx are not allowed for 1.0). Browsers use 103s over HTTP/2+ only: behind a proxy or CDN
   * that forwards them (nginx `early_hints`, Cloudflare, Fastly). Default false.
   */
  earlyHints?: boolean;
  /**
   * Bind with `SO_REUSEPORT` (Node ≥ 22.12): several processes listen on the same `port` and the kernel balances new
   * connections between them. Linux and FreeBSD only (elsewhere `serve()` throws: macOS does not balance, Windows
   * refuses). With `start({ workers })` each worker then binds its own socket instead of taking connections from the
   * primary. Needs a fixed `port` (0 throws). Default false.
   */
  reusePort?: boolean;
  /** Milliseconds to drain in-flight requests on close (default 10000). */
  grace?: number;
  /** Log unexpected failures (default console.error); app failures get `info` (`digest`, `phase`, `route`). */
  onError?: (error: unknown, request?: Request, info?: ErrorInfo) => void;
  /** Extra headers on every response; defaults add nosniff + referrer policy. */
  headers?: Record<string, string>;
  /**
   * Fixed public origin (`https://shop.example`) for request URLs, regardless of `Host`: set it behind
   * a proxy so the handler's same-origin checks compare with what the browser sees.
   */
  origin?: string;
  /**
   * Off by default: `X-Forwarded-*` headers are ignored (clients can send any). Behind reverse proxies
   * you control, say which hops to trust; the client address is then the `X-Forwarded-For` entry the
   * outermost trusted proxy appended (entries left of it are client-supplied), and protocol / host come
   * from `X-Forwarded-Proto` / `X-Forwarded-Host` at the same hop (their leftmost value when shorter).
   * - `true` or `1`: one proxy (the peer connecting to this server); `n`: the last `n` hops.
   * - `(address, hop) => boolean`: trust per hop from the socket inward (hop 0 = the peer), like
   *   Express `trust proxy`; the first untrusted address is the client. Ignored for the origin when
   *   `origin` is set.
   */
  trustProxy?: boolean | number | ((address: string, hop: number) => boolean);
  /**
   * Return memory to the OS when the server goes idle after traffic (default true on Node). V8's memory
   * reducer never runs in a process without embedder (cppgc) allocations, so a heap grown by a spike
   * stays resident for ~100 s; after 1 s without requests the adapter makes one tiny embedder allocation
   * (re-checked every 17 s, at most 5 times) while committed heap is above its settled level. No work
   * per request beyond a counter; one unref'd timer at most. `false` turns it off.
   */
  idleMemory?: boolean;
}
/**
 * A running server returned by `start()`: this process's own HTTP server (`ServerServing`, also what `serve()` and
 * `start()` without `workers` return), or the primary of `start({ workers })` (`PrimaryServing`, no server).
 * Narrow on `server` or `workers`.
 */
export type Serving = ServerServing | PrimaryServing;
/** A server listening in this process: `serve()`, `start()` with one worker, and each `start({ workers })` worker. */
export interface ServerServing {
  readonly server: Server;
  readonly url: string;
  readonly workers?: undefined;
  /** Stop accepting, report not-ready, drain within `grace`, then destroy remaining sockets. */
  close(): Promise<void>;
}
/** The primary process of `start({ workers })`: forks the workers and serves nothing itself. */
export interface PrimaryServing {
  readonly server?: undefined;
  readonly url: string;
  /** How many worker processes serve. */
  readonly workers: number;
  /** Drain every worker (each within its `grace`), then resolve once all exited. */
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
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};
const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml|manifest\+json|wasm)|image\/svg\+xml)/;
const MIN_COMPRESS = 1024;
const brotli = promisify(brotliCompress),
  gz = promisify(gzip),
  zstd = promisify(zstdCompress);

// `negotiate` / `Encoding` live in `files.ts` (pure; shared with the Bun / Deno static index) and stay exported here.
export { negotiate, type Encoding } from "./files.ts";

/** `If-None-Match` (a list, `*`, weak or strong tags) matches `etag` (weak comparison, as for GET). */
export function etagMatches(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === "*") return true;
  const opaque = (tag: string) => tag.trim().replace(/^W\//, "");
  const own = opaque(etag);
  return header.split(",").some((tag) => opaque(tag) === own);
}

/**
 * A single `Range: bytes=…` of a `size`-byte file: `[start, end]` (inclusive), `"unsatisfiable"`
 * (416), or null to send the whole file (no header, several ranges, another unit, malformed).
 */
export function byteRange(header: string | undefined, size: number): [number, number] | "unsatisfiable" | null {
  if (!header) return null;
  const match = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  if (!match[1]) {
    // Suffix: the last n bytes.
    const length = Number(match[2]);
    if (!length) return "unsatisfiable";
    return [Math.max(0, size - length), size - 1];
  }
  const start = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (match[2] && Number(match[2]) < start) return null;
  if (start >= size) return "unsatisfiable";
  return [start, end];
}

// Bodies up to this size that finish before the event loop turns are compressed in one synchronous
// call (tens of microseconds for a page; a streaming compressor costs ~0.5 ms to set up). zstd −1 runs at
// ≈ 350 MB/s here, so its one-shot call stays synchronous up to `ZSTD_SYNC` (the thread-pool round trip of the async
// convenience path cost ≈ +1 ms on a 757 KB page through the adapter: `docs/design/research/2026-10-18-floor-first.md` §9).
const ONE_SHOT_SYNC = 256 * 1024;
const ZSTD_SYNC = 4 * 1024 * 1024;
// Per-request codec levels (floor-first X1, `docs/design/research/2026-10-18-floor-first.md` §8): zstd −1 on large
// bodies (0.18× brotli q5's CPU at +10 % bytes on a 757 KB table), −3 on content-sized ones (0.5× at +14 %); brotli
// q4 is the brotli sweet spot (0.54×) for clients without zstd; gzip last.
const LARGE_BODY = 256 * 1024;
const HTML_BROTLI = { [zlib.BROTLI_PARAM_QUALITY]: 4, [zlib.BROTLI_PARAM_MODE]: zlib.BROTLI_MODE_TEXT };
const zstdLevel = (size: number) => ({ [zlib.ZSTD_c_compressionLevel]: size >= LARGE_BODY ? 1 : 3 });
function compressOnce(encoding: Exclude<Encoding, null>, body: Uint8Array): Buffer | Promise<Buffer> {
  if (encoding === "zstd") {
    const params = zstdLevel(body.length);
    return body.length > ZSTD_SYNC ? zstd(body, { params }) : zstdCompressSync(body, { params });
  }
  const params = { ...HTML_BROTLI, [zlib.BROTLI_PARAM_SIZE_HINT]: body.length };
  if (body.length > ONE_SHOT_SYNC) return encoding === "br" ? brotli(body, { params }) : gz(body, { level: 6 });
  return encoding === "br" ? brotliCompressSync(body, { params }) : gzipSync(body, { level: 6 });
}

/**
 * Streaming compressor that flushes every chunk, so streamed HTML reaches the browser promptly. `collected`: bytes
 * in hand when streaming starts (a body already past `LARGE_BODY` takes zstd's large-body level).
 */
function compressor(encoding: Exclude<Encoding, null>, collected = 0): Transform {
  if (encoding === "zstd") return createZstdCompress({ flush: zlib.ZSTD_e_flush, params: zstdLevel(collected) });
  return encoding === "br"
    ? createBrotliCompress({
        flush: zlib.BROTLI_OPERATION_FLUSH,
        params: HTML_BROTLI,
      })
    : createGzip({ flush: zlib.Z_SYNC_FLUSH, level: 6 });
}

/** A response coding: the negotiated encoding, or `dcz` with the request's dictionary. */
type Coding = Exclude<Encoding, null> | "dcz";
const packOnce = (coding: Coding, body: Uint8Array, dict: Dictionary | undefined): Buffer | Promise<Buffer> =>
  coding === "dcz" ? dczOnce(dict!, body) : compressOnce(coding, body);
const packStream = (coding: Coding, collected: number, dict: Dictionary | undefined): Transform =>
  coding === "dcz" ? dczStream(dict!, collected) : compressor(coding, collected);

/** Best-quality compression of a body compressed once and reused (client files, stored pages): brotli q11, zstd 19, gzip 9. */
function compressBest(encoding: Exclude<Encoding, null>, body: Uint8Array): Promise<Buffer> {
  if (encoding === "zstd") return zstd(body, { params: { [zlib.ZSTD_c_compressionLevel]: 19 } });
  if (encoding === "br")
    return brotli(body, {
      params: { [zlib.BROTLI_PARAM_QUALITY]: 11, [zlib.BROTLI_PARAM_MODE]: zlib.BROTLI_MODE_TEXT, [zlib.BROTLI_PARAM_SIZE_HINT]: body.length },
    });
  return gz(body, { level: 9 });
}
const SIBLING: Record<Exclude<Encoding, null>, ".zst" | ".br" | ".gz"> = { zstd: ".zst", br: ".br", gzip: ".gz" };

/**
 * Write a compressed copy next to its file (hidden temp name, then rename: a concurrent reader or worker never sees a
 * partial file; the temp is never served). False when the directory is not writable.
 */
async function persist(path: string, bytes: Buffer): Promise<boolean> {
  const temp = join(dirname(path), `.${basename(path)}.${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.tmp`);
  try {
    await writeFile(temp, bytes);
    await rename(temp, path);
    return true;
  } catch {
    await rm(temp, { force: true }).catch(() => {});
    return false;
  }
}

/** Bytes a streamed direct body may queue in the response before the renderer waits for `drain`. */
const MAX_BUFFERED = 256 * 1024;

/**
 * A rendered page's body taken straight from the renderer (`server/body.ts`): no web stream, read
 * promises or per-chunk races; slab views are released once written (the renderer pools its slabs).
 * - Complete when attached (the renderer hands a Response out only once it waits or ended, so status and
 *   headers are final either way): one write with a Content-Length (its chunks corked, or compressed in
 *   one call).
 * - Still rendering when attached (a large synchronous page past the renderer's 64 KiB queue, or pending
 *   content), uncompressed: headers + the rendered head go to the socket at once (early bytes: first byte
 *   = document head, no event-loop turn), later chunks stream (chunked; Node corks a tick's writes) with
 *   backpressure (`MAX_BUFFERED`).
 * - Compressed: chunks collect until the event loop turns (the one macrotask hop: a body complete by then
 *   = one compression call with a Content-Length). Still pending: headers go out, the collected chunks
 *   follow through the compressor and later ones stream with backpressure.
 * null: the body stream was already read, send it the usual way.
 */
function sendDirect(
  attach: DirectBody,
  res: ServerResponse,
  response: Response,
  request: Request,
  headers: Record<string, string | string[]>,
  encoding: Coding | null,
  vary: () => void,
  dict?: Dictionary,
): Promise<void> | null {
  let collected: Uint8Array[] | null = [];
  let releases: (() => void)[] = [];
  let size = 0;
  let target: Writable | null = null;
  let closed = false;
  let settle!: () => void, failed!: (error: unknown) => void;
  const result = new Promise<void>((done, fail) => ((settle = done), (failed = fail)));
  const release = () => {
    const pending = releases;
    releases = [];
    for (const done of pending) done();
  };
  // Aborted (client gone) or failed: later writes throw, which ends the render.
  const close = () => {
    closed = true;
    collected = null;
    release();
    request.signal.removeEventListener("abort", close);
    settle();
  };
  const head = () => res.writeHead(response.status, response.statusText || undefined, headers);
  /**
   * The collected chunks as one writev (`res.write` callbacks release their slab views). The socket is corked,
   * not the response: `res.uncork()` uncorks the socket before it writes a chunked body's buffered frames (one
   * syscall per frame), and `res.end()` sends the chunked terminator before them. `res.end()` / `early` uncork.
   */
  const out = (chunks: Uint8Array[]) => {
    const done = releases;
    releases = [];
    res.socket?.cork();
    for (let i = 0; i < chunks.length; i++) res.write(chunks[i]!, done[i]);
  };
  /** Early bytes: headers + what is rendered so far leave now (Node corks a tick's writes otherwise); later chunks stream. */
  const early = () => {
    const chunks = collected!;
    collected = null;
    target = res;
    head();
    out(chunks);
    // `out`'s cork and the one `res.write` holds until the next tick (not `res.uncork`: its count would go below zero).
    const socket = res.socket;
    while (socket?.writableCorked) socket.uncork();
  };
  const whole = () => {
    const chunks = collected!;
    collected = null;
    request.signal.removeEventListener("abort", close);
    if (encoding) vary();
    if (encoding && size >= MIN_COMPRESS) {
      const one = chunks.length === 1;
      const packed = packOnce(encoding, one ? chunks[0]! : Buffer.concat(chunks, size), dict);
      // Concatenated: copied already. One chunk: its slab is read until compression ends.
      if (!one) release();
      const send = (bytes: Buffer) => {
        release();
        headers["content-encoding"] = encoding;
        headers["content-length"] = String(bytes.length);
        head();
        res.end(bytes);
      };
      if (packed instanceof Promise) packed.then(send, (error) => (release(), failed(error)));
      else send(packed);
      return;
    }
    // Uncompressed: the chunks go out as they are (one corked writev), no concatenated copy.
    headers["content-length"] = String(size);
    head();
    out(chunks);
    res.end();
  };
  const stream = () => {
    if (!collected || closed) return;
    if (encoding) {
      delete headers["content-length"];
      headers["content-encoding"] = encoding;
      vary();
    }
    head();
    const packer = encoding ? packStream(encoding, size, dict) : null;
    if (packer) pipeline(packer, res).catch(close);
    const to = (target = packer ?? res);
    const chunks = collected,
      done = releases;
    collected = null;
    releases = [];
    for (let i = 0; i < chunks.length; i++) to.write(chunks[i]!, done[i]);
  };
  const sink: BodySink = {
    write(chunk, done) {
      if (closed) throw new Error("Response stream closed");
      if (collected) {
        collected.push(chunk);
        releases.push(done);
        size += chunk.length;
        return;
      }
      const out = target!;
      if (out.destroyed || out.writableEnded) throw new Error("Response stream closed");
      if (out.write(chunk, done) || out.writableLength < MAX_BUFFERED) return;
      return new Promise<void>((resolve, reject) => {
        const finish = (error?: unknown) => {
          out.off("drain", drained);
          out.off("error", finish);
          out.off("close", gone);
          error ? reject(error) : resolve();
        };
        const drained = () => finish();
        const gone = () => finish(new Error("Response stream closed"));
        out.once("drain", drained);
        out.once("error", finish);
        out.once("close", gone);
      });
    },
    end() {
      if (closed) return;
      if (collected) whole();
      else target!.end();
    },
    error(error) {
      if (closed) return;
      closed = true;
      collected = null;
      release();
      request.signal.removeEventListener("abort", close);
      failed(error);
    },
  };
  request.signal.addEventListener("abort", close, { once: true });
  res.once("finish", settle);
  if (!attach(sink)) {
    request.signal.removeEventListener("abort", close);
    res.off("finish", settle);
    return null;
  }
  if (collected) {
    // Still rendering (status and headers are final: the Response exists): the head goes out now.
    if (encoding) setImmediate(stream);
    else if (!closed) early();
  }
  return result;
}

/** The one dot-named directory served (RFC 8615: `security.txt`, `assetlinks.json`, ACME challenges), at the root only. */
const WELL_KNOWN = ".well-known";
/** Dot-named path segments are refused, except a leading `.well-known`. */
const hidden = (decoded: string): boolean => {
  const parts = decoded.split("/");
  for (let i = 0; i < parts.length; i++) if (parts[i]!.startsWith(".") && !(parts[i] === WELL_KNOWN && parts.slice(0, i).every((p) => !p))) return true;
  return false;
};

/**
 * A client file: real path, size, mtime; with an index, the precompressed siblings' sizes (−1: none; set once the
 * adapter writes one).
 */
interface StaticFile {
  readonly path: string;
  readonly size: number;
  readonly mtime: number;
  zstd?: number;
  br?: number;
  gzip?: number;
}
/** Response metadata of a `StaticFile` (`serve` `metaOf`). */
interface FileMeta {
  readonly type: string;
  readonly etag: string;
  readonly modified: string;
}

/**
 * Index the client directory once: URL path (`assets/x.js`) → file. Same rules as the per-request
 * lookup: dot-named entries skipped, symlinks resolved and kept only inside the directory.
 */
function indexFiles(client: string): Map<string, StaticFile> {
  const out = new Map<string, StaticFile>();
  let root: string;
  try {
    root = realpathSync(client);
  } catch {
    return out;
  }
  const inside = (real: string) => real === root || real.startsWith(root + sep);
  /** Size of a precompressed sibling, −1 when absent or older than its source (a copy-over deploy left a stale copy). */
  const sizeOf = (path: string, sourceMtime: number) => {
    try {
      const info = statSync(path);
      return info.isFile() && info.mtimeMs >= sourceMtime ? info.size : -1;
    } catch {
      return -1;
    }
  };
  // `open`: real directories on the current path (symlink cycles end there).
  const walk = (dir: string, key: string, open: Set<string>) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") && !(key === "" && entry.name === WELL_KNOWN)) continue;
      const path = join(dir, entry.name);
      const name = key ? key + "/" + entry.name : entry.name;
      let real: string, info;
      try {
        real = entry.isSymbolicLink() ? realpathSync(path) : path;
        info = statSync(real);
      } catch {
        continue;
      }
      if (entry.isSymbolicLink() && !inside(real)) continue;
      if (info.isDirectory()) {
        if (open.has(real)) continue;
        open.add(real);
        walk(real, name, open);
        open.delete(real);
      } else if (info.isFile())
        out.set(name, {
          path: real,
          size: info.size,
          mtime: info.mtimeMs,
          zstd: sizeOf(real + ".zst", info.mtimeMs),
          br: sizeOf(real + ".br", info.mtimeMs),
          gzip: sizeOf(real + ".gz", info.mtimeMs),
        });
    }
  };
  walk(root, "", new Set([root]));
  return out;
}

/** Host (`Host` / `X-Forwarded-Host`): a name or IP literal with an optional port (no userinfo, path or spaces). */
const HOST = /^(?:[a-z\d](?:[a-z\d_-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d_-]*[a-z\d])?)*\.?|\[[\da-f:.]+\])(?::\d{1,5})?$/i;
/**
 * The request target as an origin-relative path: origin-form (`/a?b`, also `//a`: appended to the
 * origin it stays a path) as it is; absolute-form (`http://host/a`) only for `origin` itself. Null for
 * anything else (another origin, `*`, authority-form): the URL never takes its origin from the target.
 */
function pathOf(target: string, origin: string): string | null {
  if (target.charCodeAt(0) === 47 /* / */) return target;
  if (!/^https?:\/\//i.test(target)) return null;
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return null;
  }
  return url.origin === origin && !url.username && !url.password ? url.pathname + url.search : null;
}

/** Convert a Node request into a web Request whose signal aborts when the client goes away. */
function toRequest(req: IncomingMessage, res: ServerResponse, url: string): { request: Request; abort: () => void } {
  const controller = new AbortController();
  const abort = () => {
    if (!res.writableFinished) controller.abort(new Error("Client disconnected"));
  };
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const v of value) headers.append(name, v);
    else headers.set(name, value);
  }
  const method = req.method ?? "GET";
  const body = method === "GET" || method === "HEAD" ? null : (Readable.toWeb(req) as ReadableStream<Uint8Array>);
  const init: RequestInit & { duplex?: "half" } = { method, headers, signal: controller.signal };
  if (body) {
    init.body = body;
    init.duplex = "half";
  }
  return { request: new Request(url, init), abort };
}

/**
 * Discard the rest of a request body nobody reads (`Readable.toWeb` keeps it paused once its queue is
 * full, and Node's own dump skips requests a reader consumed): keep-alive and pipelined requests go on.
 */
function drain(req: IncomingMessage): void {
  if (req.complete || req.destroyed) return;
  req.removeAllListeners("data");
  req.resume();
}

/** Create the Node request listener (exposed for custom servers and tests). */
export function createListener(options: ServeOptions): {
  listener: (req: IncomingMessage, res: ServerResponse) => void;
  drain: () => void;
  idle: () => Promise<void>;
} {
  const { handler, earlyHints = false, onError = (error: unknown) => console.error(error) } = options;
  const compress = options.compress !== false;
  const codecs = typeof options.compress === "object" ? options.compress : null;
  const withZstd = codecs?.zstd !== false;
  const precompress = compress && codecs?.precompress !== false;
  const prefix = normalizeBase(options.base);
  const immutable = options.immutable ?? ((pathname: string) => pathname.startsWith(prefix + "/assets/"));
  // Header names compare case-insensitively: `res.writeHead` sends differently cased keys as separate
  // headers, so an option (or a response header) of the same name replaces the default, never doubles it.
  const base: Record<string, string> = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin" };
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    for (const key of Object.keys(base)) if (key.toLowerCase() === name.toLowerCase()) delete base[key];
    base[name] = value;
  }
  const client = options.client ? resolve(options.client) : null;
  // Compression dictionaries (RFC 9842): sampled at start (`serve`), else the client build's manifest.
  const dictionaries: DictionaryRegistry | null =
    !compress || options.dictionary === false
      ? null
      : ((options as { [SAMPLED]?: DictionaryRegistry | null })[SAMPLED] ?? (client ? readDictionaries(client) : null));
  /**
   * A request's dictionary work, for a compressible response at `pathname`: `covers` = the most specific dictionary of
   * the path (its answers vary by `Available-Dictionary`; HTML pages link it when the browser lacks it), `use` = the
   * dictionary to encode with (`dcz`), when the request names one that covers the path and accepts `dcz`.
   */
  const dictionaryWork = (req: IncomingMessage, pathname: string): { covers: Dictionary; use: Dictionary | undefined; has: boolean } | null => {
    const covers = dictionaries && dictionaryFor(dictionaries, pathname);
    if (!covers) return null;
    const available = req.headers["available-dictionary"];
    return {
      covers,
      use: dictionaryOf(dictionaries, available, req.headers["accept-encoding"], pathname),
      has: typeof available === "string" && available.trim() === covers.available,
    };
  };
  /** `Link` of an HTML answer: the covering dictionary appended when the browser does not have it. */
  const linked = (work: { covers: Dictionary; has: boolean }, link: string | undefined): string | undefined =>
    work.has ? link : link ? link + ", " + dictionaryLink(work.covers) : dictionaryLink(work.covers);
  const dictionaryBodies = new Map<string, Promise<Buffer>>(); // a dictionary file's zstd / br copy by id|encoding
  const fixedOrigin = options.origin ? new URL(options.origin).origin : null;
  const trust = options.trustProxy;
  const hops = trust === true ? 1 : typeof trust === "number" && trust > 0 ? Math.floor(trust) : 0;
  const trusting = hops > 0 || typeof trust === "function";
  /** Comma-separated header values, all occurrences, in order. */
  const list = (value: string | string[] | undefined): string[] =>
    value === undefined
      ? []
      : (Array.isArray(value) ? value.join(",") : value)
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
  /** Trusted hops and the client address: `X-Forwarded-For` entries then the peer, read from the right. */
  const forwarded = (req: IncomingMessage): { trusted: number; address: string | undefined } => {
    const peer = req.socket.remoteAddress;
    if (!trusting) return { trusted: 0, address: peer };
    const chain = [...list(req.headers["x-forwarded-for"]), ...(peer ? [peer] : [])];
    if (typeof trust !== "function") return { trusted: hops, address: chain[Math.max(0, chain.length - 1 - hops)] };
    let hop = 0;
    while (hop < chain.length && trust(chain[chain.length - 1 - hop]!, hop)) hop++;
    // Every hop trusted: the leftmost entry is as close to the client as it gets.
    return { trusted: hop, address: chain[Math.max(0, chain.length - 1 - hop)] };
  };
  /** A forwarded header's value at the outermost trusted hop (its leftmost when it has fewer entries). */
  const hopValue = (value: string | string[] | undefined, trusted: number): string | undefined => {
    const values = list(value);
    return values[Math.max(0, values.length - trusted)];
  };
  /** Public origin of a request: the fixed `origin`, else (trusted) forwarded headers, else the socket's; null: malformed host (400). */
  const originOf = (req: IncomingMessage, trusted: number): string | null => {
    if (fixedOrigin) return fixedOrigin;
    const tls = (req.socket as { encrypted?: boolean }).encrypted === true;
    let scheme = tls ? "https" : "http",
      host = req.headers.host;
    if (trusted > 0) {
      const proto = hopValue(req.headers["x-forwarded-proto"], trusted)?.toLowerCase();
      if (proto === "https" || proto === "http") scheme = proto;
      host = hopValue(req.headers["x-forwarded-host"], trusted) ?? host;
    }
    if (host === undefined) return scheme + "://localhost";
    return HOST.test(host) ? scheme + "://" + host : null;
  };
  let clientReal: string | null = null;
  let draining = false,
    inflight = 0,
    wake: (() => void) | null = null;
  const memory = options.idleMemory !== false && idleMemorySupported() ? idleMemory(() => inflight) : null;
  const cache = new Map<string, Buffer>(); // compressed static bodies by path|etag|encoding
  const pending = new Map<string, Promise<Buffer>>(); // compressions in flight by the same key: N concurrent first requests compress once
  const index = client && options.static !== "fs" ? indexFiles(client) : null;
  const metas = new WeakMap<StaticFile, FileMeta>();

  /** Resolve a URL path to a file inside the client directory; null when absent or escaping. */
  async function file(pathname: string): Promise<StaticFile | null> {
    if (!client) return null;
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    if (decoded.includes("\0") || hidden(decoded)) return null;
    if (index) return index.get(decoded.split("/").filter(Boolean).join("/")) ?? null;
    clientReal ??= await realpath(client).catch(() => null);
    if (!clientReal) return null;
    const candidate = resolve(clientReal, "." + decoded);
    try {
      const real = await realpath(candidate);
      if (real !== clientReal && !real.startsWith(clientReal + sep)) return null;
      const info = await stat(real);
      return info.isFile() ? { path: real, size: info.size, mtime: info.mtimeMs } : null;
    } catch {
      return null;
    }
  }

  /** MIME type + validators of a file; derived once per indexed entry (fixed size / mtime), per request without an index. */
  function metaOf(found: StaticFile): FileMeta {
    let meta = metas.get(found);
    if (meta === undefined) {
      meta = {
        type: MIME[extname(found.path).toLowerCase()] ?? "application/octet-stream",
        etag: `W/"${found.size.toString(16)}-${Math.floor(found.mtime).toString(16)}"`,
        modified: new Date(found.mtime).toUTCString(),
      };
      if (index) metas.set(found, meta);
    }
    return meta;
  }

  /** A dictionary file: content-hashed, a year fresh (browsers keep a dictionary only while it is fresh), `Use-As-Dictionary`. */
  async function serveDictionary(req: IncomingMessage, res: ServerResponse, entry: Dictionary): Promise<void> {
    const headers: Record<string, string> = {
      ...base,
      "Content-Type": "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: `"${entry.id}"`,
      "Use-As-Dictionary": entry.use,
      Vary: "Accept-Encoding",
    };
    if (etagMatches(one(req.headers["if-none-match"]), headers.ETag!)) return void res.writeHead(304, headers).end();
    const encoding = negotiate(req.headers["accept-encoding"], withZstd);
    if (!encoding)
      return void res.writeHead(200, { ...headers, "Content-Length": String(entry.bytes.length) }).end(req.method === "HEAD" ? undefined : entry.bytes);
    const key = entry.id + "|" + encoding;
    let job = dictionaryBodies.get(key);
    if (!job) dictionaryBodies.set(key, (job = compressBest(encoding, entry.bytes)));
    const body = await job;
    res.writeHead(200, { ...headers, "Content-Encoding": encoding, "Content-Length": String(body.length) });
    res.end(req.method === "HEAD" ? undefined : body);
  }

  async function serveFile(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    if (prefix && !pathname.startsWith(prefix + "/")) return false;
    const found = await file(pathname.slice(prefix.length));
    if (!found) return false;
    const { type, etag, modified } = metaOf(found);
    const headers: Record<string, string> = {
      ...base,
      "Content-Type": type,
      "Cache-Control": immutable(pathname) ? "public, max-age=31536000, immutable" : "no-cache",
      ETag: etag,
      "Last-Modified": modified,
      Vary: "Accept-Encoding",
    };
    // Immutable (content-hashed) files keep their precompressed copies: the dictionaries are built from pages and data.
    const work = compress && COMPRESSIBLE.test(type) && !immutable(pathname) ? dictionaryWork(req, pathname) : null;
    if (work) {
      headers.Vary = "Accept-Encoding, Available-Dictionary";
      const link = type.startsWith("text/html") ? linked(work, undefined) : undefined;
      if (link) headers.Link = link;
    }
    // `If-None-Match` wins over `If-Modified-Since` (RFC 9110 13.2.2); dates compare at second precision.
    const match = req.headers["if-none-match"];
    const since = match === undefined ? req.headers["if-modified-since"] : undefined;
    if (match !== undefined ? etagMatches(match, etag) : since !== undefined && Math.floor(found.mtime / 1000) * 1000 <= Date.parse(since)) {
      res.writeHead(304, headers).end();
      return true;
    }
    // One byte range (video/audio seeking, resumed downloads): identity bytes, 206. An `If-Range` other
    // than the current `Last-Modified` sends the whole file (the ETag is weak: never a strong match).
    const ifRange = req.headers["if-range"];
    const range = req.headers.range !== undefined && (ifRange === undefined || ifRange === modified) ? byteRange(req.headers.range, found.size) : null;
    if (range === "unsatisfiable") {
      res.writeHead(416, { ...headers, "Content-Range": `bytes */${found.size}`, "Accept-Ranges": "bytes" }).end();
      return true;
    }
    if (range) {
      const [from, to] = range;
      res.writeHead(206, {
        ...headers,
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${from}-${to}/${found.size}`,
        "Content-Length": String(to - from + 1),
      });
      if (req.method === "HEAD") res.end();
      else await pipeline(createReadStream(found.path, { start: from, end: to }), res);
      return true;
    }
    if (work?.use && found.size >= MIN_COMPRESS) {
      // `dcz` against the browser's dictionary: zstd 19 once per (file, dictionary), kept in memory.
      const use = work.use;
      const key = found.path + "|" + etag + "|dcz:" + use.id;
      let body = cache.get(key);
      if (!body) {
        let job = pending.get(key);
        if (!job) {
          job = readFile(found.path)
            .then((raw) => dczBest(use, raw))
            .then((bytes) => {
              if (cache.size > 512) cache.clear();
              cache.set(key, bytes);
              return bytes;
            })
            .finally(() => pending.delete(key));
          pending.set(key, job);
        }
        body = await job;
      }
      res.writeHead(200, { ...headers, "Content-Encoding": "dcz", "Content-Length": String(body.length) });
      res.end(req.method === "HEAD" ? undefined : body);
      return true;
    }
    const encoding = compress && COMPRESSIBLE.test(type) && found.size >= MIN_COMPRESS ? negotiate(req.headers["accept-encoding"], withZstd) : null;
    if (encoding) {
      const ext = SIBLING[encoding];
      // A copy compressed in this process (bounded memory), else a precompressed sibling on disk (build-time, or
      // written by an earlier process), else compress once at the best quality: kept in memory, and for an immutable
      // file written next to it (hidden temp + rename) so later starts read it from disk.
      const key = found.path + "|" + etag + "|" + encoding;
      let body = cache.get(key);
      if (!body) {
        // A sibling older than its source is a stale copy (copy-over deploy): ignored and overwritten below.
        const sibling =
          found[encoding] ??
          (await stat(found.path + ext).then(
            (s) => (s.isFile() && s.mtimeMs >= found.mtime ? s.size : -1),
            () => -1,
          ));
        if (sibling >= 0) body = await readFile(found.path + ext);
        else {
          let job = pending.get(key);
          if (!job) {
            job = readFile(found.path)
              .then((raw) => compressBest(encoding, raw))
              .then((bytes) => {
                if (cache.size > 512) cache.clear();
                cache.set(key, bytes);
                if (precompress && immutable(pathname))
                  void persist(found.path + ext, bytes).then((written) => {
                    if (written && index) found[encoding] = bytes.length;
                  });
                return bytes;
              })
              .finally(() => pending.delete(key));
            pending.set(key, job);
          }
          body = await job;
        }
      }
      res.writeHead(200, { ...headers, "Content-Encoding": encoding, "Content-Length": String(body.length) });
      res.end(req.method === "HEAD" ? undefined : body);
      return true;
    }
    res.writeHead(200, { ...headers, "Accept-Ranges": "bytes", "Content-Length": String(found.size) });
    if (req.method === "HEAD") res.end();
    else if (!res.destroyed) {
      // The client may go away mid-file (page left, preload cancelled): a closed response is not a server error.
      try {
        await pipeline(createReadStream(found.path), res);
      } catch (error) {
        if (!res.destroyed && !res.writableEnded) throw error;
      }
    }
    return true;
  }

  // Route rules' stored pages (`createApp({ routeRules })`): served before a Request exists, like a static file —
  // headers merged once per page, br / gzip compressed once per page (in the background, best quality).
  interface PageOut {
    plain: Record<string, string>;
    unchanged: Record<string, string>;
    zstd?: Promise<Buffer>;
    br?: Promise<Buffer>;
    gzip?: Promise<Buffer>;
    /** `dcz` copies by dictionary id. */
    dcz?: Map<string, Promise<Buffer>>;
  }
  const pages = new WeakMap<CachedPage, PageOut>();
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value.join(", ") : value);
  function pageOut(page: CachedPage): PageOut {
    let out = pages.get(page);
    if (!out) {
      const plain: Record<string, string> = {};
      const unchanged: Record<string, string> = {};
      for (const name in base) if (!page.headers.some(([own]) => own === name.toLowerCase())) plain[name] = base[name]!;
      for (const [name, value] of page.headers) {
        plain[name] = value;
        if (name === "cache-control" || name === "etag" || name === "last-modified" || name === "vary") unchanged[name] = value;
      }
      // A br / gzip copy exists for this page: identity answers and 304s vary by Accept-Encoding too.
      if (compress && page.body.byteLength >= MIN_COMPRESS && COMPRESSIBLE.test(plain["content-type"] ?? ""))
        plain.vary = unchanged.vary = plain.vary ? plain.vary + ", Accept-Encoding" : "Accept-Encoding";
      pages.set(page, (out = { plain, unchanged }));
    }
    return out;
  }
  async function serveCached(req: IncomingMessage, res: ServerResponse, page: CachedPage, pathname: string): Promise<void> {
    let out = pageOut(page);
    const age = String(Math.max(0, Math.floor((Date.now() - page.created) / 1000)));
    const type = out.plain["content-type"] ?? "";
    const work = compress && page.body.byteLength >= MIN_COMPRESS && COMPRESSIBLE.test(type) ? dictionaryWork(req, pathname) : null;
    if (work) {
      // Per request: the dictionary's Vary, and the Link while the browser lacks it (a copy of the merged headers).
      const vary = varyDictionary(out.plain.vary);
      const link = type.startsWith("text/html") ? linked(work, out.plain.link) : out.plain.link;
      out = { ...out, plain: { ...out.plain, vary, ...(link ? { link } : {}) }, unchanged: { ...out.unchanged, vary } };
    }
    const match = one(req.headers["if-none-match"]);
    const since = match === undefined ? one(req.headers["if-modified-since"]) : undefined;
    if (match !== undefined ? etagMatches(match, page.etag) : since !== undefined && page.modifiedAt <= Date.parse(since)) {
      res.writeHead(304, { ...out.unchanged, age, "x-rivet-cache": "HIT" }).end();
      return;
    }
    if (work?.use && req.method !== "HEAD") {
      const use = work.use;
      const copies = (pageOut(page).dcz ??= new Map());
      let job = copies.get(use.id);
      if (!job) copies.set(use.id, (job = dczBest(use, page.body).then((packed) => (page.charge(packed.length), packed))));
      const body = await job;
      res.writeHead(200, { ...out.plain, age, "x-rivet-cache": "HIT", "content-encoding": "dcz", "content-length": String(body.length) });
      res.end(body);
      return;
    }
    const encoding =
      compress && req.method !== "HEAD" && page.body.byteLength >= MIN_COMPRESS && COMPRESSIBLE.test(out.plain["content-type"] ?? "")
        ? negotiate(req.headers["accept-encoding"], withZstd)
        : null;
    if (!encoding) {
      res.writeHead(200, { ...out.plain, age, "x-rivet-cache": "HIT", "content-length": String(page.body.byteLength) });
      res.end(req.method === "HEAD" ? undefined : page.body);
      return;
    }
    const stored = pageOut(page);
    const body = await (stored[encoding] ??= compressBest(encoding, page.body).then((packed) => (page.charge(packed.length), packed)));
    res.writeHead(200, { ...out.plain, age, "x-rivet-cache": "HIT", "content-encoding": encoding, "content-length": String(body.length) });
    res.end(body);
  }

  async function serveResponse(req: IncomingMessage, res: ServerResponse, response: Response, request: Request, pathname: string): Promise<void> {
    const headers: Record<string, string | string[]> = {};
    for (const name in base) if (!response.headers.has(name)) headers[name] = base[name]!;
    response.headers.forEach((value, name) => {
      if (name === "set-cookie") return;
      headers[name] = value;
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) headers["set-cookie"] = cookies;
    const type = response.headers.get("content-type") ?? "";
    const body = response.body;
    const compressible = compress && body && !response.headers.has("content-encoding") && COMPRESSIBLE.test(type);
    const work = compressible ? dictionaryWork(req, pathname) : null;
    const encoding: Coding | null = work?.use ? "dcz" : compressible ? negotiate(req.headers["accept-encoding"], withZstd) : null;
    const vary = work
      ? () => (headers.vary = varyDictionary(response.headers.get("vary") ?? undefined))
      : () => (headers.vary = response.headers.has("vary") ? response.headers.get("vary") + ", Accept-Encoding" : "Accept-Encoding");
    if (work && response.status === 200 && type.startsWith("text/html")) {
      const link = linked(work, response.headers.get("link") ?? undefined);
      if (link) headers.link = link;
    }
    if (!body || req.method === "HEAD") {
      if (encoding) vary();
      res.writeHead(response.status, response.statusText || undefined, headers);
      await body?.cancel().catch(() => {});
      res.end();
      return;
    }
    const direct = (response as { [DIRECT_BODY]?: DirectBody })[DIRECT_BODY];
    const sent = direct && !body.locked ? sendDirect(direct, res, response, request, headers, encoding, vary, work?.use) : null;
    if (sent) return sent;
    // Most pages render synchronously: when the whole body is in before the event loop turns, it
    // goes out in one write with a Content-Length (compressed in one call). A body still pending
    // then (streamed async boundaries) streams from here, its first chunks flushed right away.
    const reader = body.getReader();
    const cancel = () => void reader.cancel(request.signal.reason).catch(() => {});
    request.signal.addEventListener("abort", cancel, { once: true });
    const chunks: Uint8Array[] = [];
    let turned = false;
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
      pending = reader.read();
    }
    if (!pending) {
      request.signal.removeEventListener("abort", cancel);
      let size = 0;
      for (const chunk of chunks) size += chunk.byteLength;
      if (encoding) vary();
      if (encoding && size >= MIN_COMPRESS) {
        const packed = await packOnce(encoding, chunks.length === 1 ? chunks[0]! : Buffer.concat(chunks, size), work?.use);
        headers["content-encoding"] = encoding;
        headers["content-length"] = String(packed.length);
        res.writeHead(response.status, response.statusText || undefined, headers);
        res.end(packed);
        return;
      }
      // Uncompressed: the body's chunks go out as they are (one corked writev), no concatenated copy.
      headers["content-length"] = String(size);
      res.writeHead(response.status, response.statusText || undefined, headers);
      if (chunks.length > 1) {
        res.cork();
        for (let i = 0; i < chunks.length - 1; i++) res.write(chunks[i]!);
      }
      res.end(chunks[chunks.length - 1]);
      return;
    }
    let collected = 0;
    if (encoding) {
      delete headers["content-length"];
      headers["content-encoding"] = encoding;
      vary();
      for (const chunk of chunks) collected += chunk.byteLength;
    }
    res.writeHead(response.status, response.statusText || undefined, headers);
    const rest = pending;
    const source = Readable.from(
      (async function* () {
        try {
          yield* chunks;
          for (let next = await rest; !next.done; next = await reader.read()) yield next.value;
        } finally {
          request.signal.removeEventListener("abort", cancel);
        }
      })(),
      { objectMode: false },
    );
    await (encoding ? pipeline(source, packStream(encoding, collected, work?.use), res) : pipeline(source, res));
  }

  const reject = (res: ServerResponse, status: number, message: string) =>
    void res.writeHead(status, { ...base, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", Connection: "close" }).end(message);
  const listener = (req: IncomingMessage, res: ServerResponse) => {
    const via = forwarded(req);
    const origin = originOf(req, via.trusted);
    if (origin === null) return reject(res, 400, "Bad Request: malformed Host");
    const target = pathOf(req.url ?? "/", origin);
    if (target === null) return reject(res, 400, "Bad Request: request target");
    const pathname = target.split("?", 1)[0]!;
    if (pathname === "/healthz") {
      res.writeHead(200, { ...base, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }).end("ok");
      return;
    }
    if (pathname === "/readyz") {
      res.writeHead(draining ? 503 : 200, { ...base, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      res.end(draining ? "draining" : "ready");
      return;
    }
    inflight++;
    memory?.request();
    if (draining) res.setHeader("Connection", "close");
    const done = () => {
      if (--inflight === 0) {
        if (wake) wake();
        memory?.idle();
      }
    };
    res.once("close", done);
    let request: Request | undefined;
    void (async () => {
      try {
        if (req.method === "GET" || req.method === "HEAD") {
          const dictionaryFile = dictionaries?.files.get(pathname);
          if (dictionaryFile) return await serveDictionary(req, res, dictionaryFile);
          if (await serveFile(req, res, pathname)) return;
          const lookup = (handler as { [ROUTE_CACHE]?: CacheLookup })[ROUTE_CACHE];
          const page = lookup?.(req.method, origin, pathname, target.slice(pathname.length), (name) => one(req.headers[name]));
          if (page) return await serveCached(req, res, page, pathname);
        }
        const converted = toRequest(req, res, origin + target);
        request = converted.request;
        if (earlyHints && req.httpVersionMinor >= 1)
          (request as unknown as Record<symbol, unknown>)[EARLY_HINTS] = (links: readonly string[]) => {
            if (!res.headersSent && !res.destroyed) res.writeEarlyHints({ link: links as string[] });
          };
        res.once("close", converted.abort);
        // A body the handler never read (CSRF 403, 413, guard, unknown action…): drain it once the
        // response is out, as Node does for untouched requests, so the connection stays usable.
        if (converted.request.body) res.once("finish", () => drain(req));
        const address = via.address;
        const context: RequestContext = { nonce: nonce(), ...(address ? { address } : {}) };
        const response = await handler(request, context);
        await serveResponse(req, res, response, request, pathname);
      } catch (error) {
        if (request?.signal.aborted || (error as { code?: string })?.code === "ERR_STREAM_PREMATURE_CLOSE") return;
        try {
          onError(error, request);
        } catch (failure) {
          // A throwing reporter must not become an unhandled rejection (it would end the process).
          console.error(failure);
        }
        if (!res.headersSent) {
          res.writeHead(500, { ...base, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
          res.end("Internal Server Error");
        } else res.destroy(error instanceof Error ? error : undefined);
      }
    })();
  };
  return {
    listener,
    drain: () => {
      draining = true;
      memory?.stop();
    },
    idle: () => (inflight === 0 ? Promise.resolve() : new Promise<void>((done) => (wake = done))),
  };
}

/**
 * `serve({ dictionary: { samples } })`: each sample path and its data answer rendered once through the handler (fixed
 * nonce, so the bytes repeat across workers), their shared segments = the site's dictionary (`match="<base>/*"`).
 */
async function sampleDictionary(options: ServeOptions): Promise<DictionaryRegistry | null> {
  const { samples = [], max } = options.dictionary || {};
  const origin = options.origin ? new URL(options.origin).origin : "http://localhost";
  const prefix = normalizeBase(options.base);
  const bodies: Uint8Array[] = [];
  for (const path of samples)
    for (const data of [false, true]) {
      const url = new URL(path, origin);
      if (data) url.searchParams.set(DATA_PARAM, "data");
      const response = await options.handler(new Request(url, { headers: { accept: data ? "application/json" : "text/html" } }), { nonce: "rivet-dictionary" });
      if (response.status === 200) bodies.push(new Uint8Array(await response.arrayBuffer()));
      else await response.body?.cancel();
    }
  const bytes = buildDictionary(bodies, { ...(max ? { max } : {}), minSamples: samples.length > 1 ? 2 : 1 });
  if (bytes.length < 256) return null;
  const { id } = dictionaryEntry(bytes, "", prefix + "/");
  return dictionaryRegistry([dictionaryEntry(bytes, `${prefix}/_rivet/dict/${id}.dict`, prefix + "/")]);
}

/** Listen on `port` (0 = ephemeral). Resolves once listening. */
export async function serve(options: ServeOptions): Promise<ServerServing> {
  if (options.reusePort) {
    // Port 0 would give every worker its own port; elsewhere the kernel does not balance (macOS) or refuses (Windows).
    if (!options.port) throw new TypeError("serve({ reusePort }) needs a fixed port (not 0)");
    if (process.platform !== "linux" && process.platform !== "freebsd")
      throw new TypeError(`serve({ reusePort }) balances connections only on Linux and FreeBSD (this is ${process.platform}); leave it off here`);
  }
  const sampled = options.dictionary && options.dictionary.samples?.length && options.compress !== false ? await sampleDictionary(options) : undefined;
  const { listener, drain, idle } = createListener(sampled !== undefined ? ({ ...options, [SAMPLED]: sampled } as ServeOptions) : options);
  const server = createServer({ requestTimeout: 30_000, headersTimeout: 15_000, keepAliveTimeout: 5_000 }, listener);
  const sockets = new Set<Socket>();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    const listen = { port: options.port ?? 3000, host: options.host ?? "127.0.0.1" };
    // `exclusive`: a cluster worker binds its own SO_REUSEPORT socket (else the primary would own one shared handle).
    server.listen(options.reusePort ? { ...listen, reusePort: true, exclusive: true } : listen, () => {
      server.off("error", fail);
      done();
    });
  });
  const address = server.address() as AddressInfo;
  const host = address.family === "IPv6" ? `[${address.address}]` : address.address;
  let closing: Promise<void> | null = null;
  return {
    server,
    url: `http://${host}:${address.port}`,
    close: () =>
      (closing ??= (async () => {
        drain();
        const stopped = new Promise<void>((done) => server.close(() => done()));
        server.closeIdleConnections();
        const grace = new Promise<void>((done) => setTimeout(done, options.grace ?? 10_000).unref());
        await Promise.race([idle(), grace]);
        for (const socket of sockets) socket.destroy();
        await stopped;
      })()),
  };
}

/** Close on SIGTERM/SIGINT once; exits the process after draining. */
export function closeOnSignals(serving: Serving, signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"]): void {
  const stop = () => {
    for (const signal of signals) process.off(signal, stop);
    serving.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  };
  for (const signal of signals) process.once(signal, stop);
}

/** Options of `start()`: serve a build output directory. */
export interface StartOptions extends Omit<ServeOptions, "handler" | "client" | "earlyHints"> {
  /** Build output with `client/` and `server/` (default `dist`). */
  dist?: string;
  /** Out-of-order streaming for pending `Async` boundaries. */
  stream?: { deadline?: number };
  /** i18n: per-locale client builds (`client/<locale>/`, see `loadBuild`); their `assets/` are immutable. */
  locales?: readonly string[];
  /** Request body limit for unsafe methods (413 past it); default 1 MiB, multipart 10 MiB. */
  maxBody?: BodyLimit;
  /** i18n: error-page locale when the request has none settled (see `loadBuild`). */
  resolveLocale?: (request: Request) => string | undefined | Promise<string | undefined>;
  /** HTML pages' Content-Security-Policy (`createApp` `csp`): default `strictCSP`; `{ trustedTypes, directives }` (`strictCSP` with them), a `(nonce) => policy` function, or `false` (none). */
  csp?: AppConfig["csp"];
  /** Preload planner (`createApp` `preload`): `background` byte budget of idle-time visible prefetch, `lean` (nothing before an interaction); per page when a function. */
  preload?: AppConfig["preload"];
  /** Route rules (`createApp` `routeRules`; default: the entry's, `rivetRouter({ routeRules })`): headers + in-process page cache per path pattern; stored pages are served before a Request is built. */
  routeRules?: AppConfig["routeRules"];
  /** The route rules' page store (`createApp` `routeCache`: bounds, `origin`; default `origin`: this adapter's). */
  routeCache?: AppConfig["routeCache"];
  /** Cross-request fragment cache (`createApp` `renderCache`, `createRenderCache()` from `@rivetjs/runtime/server-cache`). */
  renderCache?: AppConfig["renderCache"];
  /**
   * Worker processes (node:cluster): `"auto"` = `os.availableParallelism()`, default 1 (this process serves). With
   * more, this process becomes the primary: it forks that many copies of the running script, each serving the build,
   * restarts crashed ones and resolves with `{ url, workers, close }` (close drains every worker). Connections are
   * handed out round robin by the primary, or balanced by the kernel with `reusePort` (Linux). The route cache is per
   * worker; `revalidate()` reaches every worker through the primary. Call `start()` at the top level of the script
   * (workers run it again).
   */
  workers?: number | "auto";
  /** Early hints (`createApp` `earlyHints`): `103 Early Hints` + `Link` headers for pages (stylesheets, build-asset fonts, `links`; `runtime: true` adds the resume entry). Default off. */
  earlyHints?: AppConfig["earlyHints"];
}

/**
 * Serve a production build of a file-routed app: resume manifest, entry stylesheets, client assets. Without `workers`
 * (or `workers: 1`) resolves with this process's server; with `workers` resolves with a `ServerServing` in each
 * worker and a `PrimaryServing` (no `server`) in the primary.
 */
export function start(options?: StartOptions & { workers?: 1 }): Promise<ServerServing>;
export function start(options?: StartOptions): Promise<Serving>;
export async function start(options: StartOptions = {}): Promise<Serving> {
  const count = options.workers === "auto" ? availableParallelism() : Math.max(1, Math.floor(options.workers ?? 1));
  if (count > 1) {
    const { isPrimary, primary, worker } = await import("./cluster.ts");
    const single = { ...options, workers: 1 as const };
    return isPrimary() ? primary(count, options.grace ?? 10_000, options.onError ?? ((error) => console.error(error))) : worker(() => start(single));
  }
  const {
    dist = "dist",
    stream,
    locales,
    resolveLocale,
    maxBody,
    csp,
    preload,
    routeRules,
    routeCache,
    renderCache,
    earlyHints,
    workers: _workers,
    ...serveOptions
  } = options;
  const { handler, client, entry } = await loadBuild(
    dist,
    {
      ...(stream ? { stream } : {}),
      ...(options.onError ? { onError: options.onError } : {}),
      ...(maxBody !== undefined ? { maxBody } : {}),
      ...(csp !== undefined ? { csp } : {}),
      ...(preload ? { preload } : {}),
      ...(routeRules ? { routeRules } : {}),
      // The fixed public origin is the one stored pages are for (`isr` rules need one).
      ...(routeCache || serveOptions.origin ? { routeCache: { ...(serveOptions.origin ? { origin: serveOptions.origin } : {}), ...routeCache } } : {}),
      ...(renderCache ? { renderCache } : {}),
      ...(earlyHints ? { earlyHints } : {}),
    },
    locales?.length ? { locales, ...(resolveLocale ? { resolveLocale } : {}) } : {},
  );
  const prefix = normalizeBase(serveOptions.base ?? entry.base);
  const immutable =
    serveOptions.immutable ??
    (locales?.length ? (pathname: string) => locales.some((locale) => pathname.startsWith(prefix + "/" + locale + "/assets/")) : undefined);
  return serve({
    ...serveOptions,
    handler,
    client,
    ...(prefix ? { base: prefix } : {}),
    ...(immutable ? { immutable } : {}),
    ...(earlyHints ? { earlyHints: true } : {}),
  });
}
