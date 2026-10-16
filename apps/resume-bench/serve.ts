// Static server for one built lane: brotli when accepted, no caching (every run is cold), and
// 404 for /item/* so detail navigation must happen in the browser.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { brotliCompressSync, constants } from "node:zlib";
import { extname, resolve, sep } from "node:path";
import type { AddressInfo } from "node:net";

const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

export async function serve(dir: string): Promise<{ url: string; close: () => Promise<unknown> }> {
  const cache = new Map<string, { body: Buffer; br: Buffer }>();
  const load = async (path: string) => {
    if (!cache.has(path)) {
      const body = await readFile(path);
      cache.set(path, { body, br: brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }) });
    }
    return cache.get(path)!;
  };
  const server = createServer(async (req, res) => {
    const { pathname } = new URL(req.url!, "http://x");
    const file = resolve(dir, "." + (pathname === "/" ? "/index.html" : decodeURIComponent(pathname)));
    if (pathname.startsWith("/item/") || !(file + sep).startsWith(resolve(dir) + sep) && file !== resolve(dir)) {
      res.writeHead(404).end("not found");
      return;
    }
    try {
      const { body, br } = await load(file);
      const brotli = /\bbr\b/.test(req.headers["accept-encoding"] ?? "");
      res.writeHead(200, {
        "content-type": TYPES[extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store",
        ...(brotli ? { "content-encoding": "br" } : {}),
      });
      res.end(brotli ? br : body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  return {
    url: "http://127.0.0.1:" + (server.address() as AddressInfo).port,
    close: () => new Promise((done) => server.close(done)),
  };
}
