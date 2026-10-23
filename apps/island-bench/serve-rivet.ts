// HTTP server of the Rivet lanes (per-request streaming SSR + static assets). No compression by default — like every
// lane of the bench (Astro's standalone server has none; Next runs with `compress: false`); `IB_GZIP=1` turns gzip on.
// Usage: node apps/island-bench/serve-rivet.ts <lane dist dir> <port>. Prints "ready" once listening.
import { createServer } from "node:http";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { constants, createGzip, gzipSync } from "node:zlib";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";

const [dist, port] = [resolve(process.argv[2]!), Number(process.argv[3])];
const GZIP = process.env.IB_GZIP === "1";
const manifest = JSON.parse(readFileSync(join(dist, "client/.vite/rivet-resume.json"), "utf8")) as ResumeManifest;
const { render } = (await import(pathToFileURL(join(dist, "server/server.js")).href)) as {
  render(manifest: ResumeManifest, write: (chunk: string) => void): void | Promise<void>;
};
const TYPES: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };
/** Static files (no `.vite`), gzip-compressed once at startup. */
const files = new Map<string, { type: string; raw: Buffer; gz: Buffer }>();
const walk = (dir: string, base: string): void => {
  for (const name of readdirSync(dir)) {
    if (name === ".vite") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, base + name + "/");
    else {
      const raw = readFileSync(path);
      files.set(base + name, { type: TYPES[extname(name)] ?? "application/octet-stream", raw, gz: gzipSync(raw) });
    }
  }
};
walk(join(dist, "client"), "/");

createServer((req, res) => {
  const gzip = GZIP && /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""));
  const url = (req.url ?? "/").split("?")[0]!;
  if (url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...(gzip ? { "content-encoding": "gzip" } : {}) });
    // Writes are batched per macrotask (one compressed flush each), so the shell goes out right away and a streamed
    // tail follows when it is ready, without a flush per tiny chunk.
    const out = gzip ? createGzip() : null;
    if (out) out.pipe(res);
    let pending: string[] = [];
    let scheduled = false,
      closed = false;
    const flush = () => {
      scheduled = false;
      if (closed) return;
      const text = pending.join("");
      pending = [];
      if (!out) return void res.write(text);
      out.write(text);
      out.flush(constants.Z_SYNC_FLUSH);
    };
    const write = (chunk: string) => {
      pending.push(chunk);
      if (!scheduled) ((scheduled = true), setImmediate(flush));
    };
    const finish = () => {
      closed = true;
      const text = pending.join("");
      pending = [];
      if (out) out.end(text);
      else res.end(text);
    };
    const done = render(manifest, write);
    if (done instanceof Promise) done.then(finish, (error: unknown) => (console.error(error), res.destroy()));
    else finish();
    return;
  }
  const file = files.get(url);
  if (!file) return void res.writeHead(404).end();
  res.writeHead(200, { "content-type": file.type, "cache-control": "no-store", ...(gzip ? { "content-encoding": "gzip" } : {}) });
  res.end(gzip ? file.gz : file.raw);
}).listen(port, "127.0.0.1", () => console.log("ready"));
