// Shared static file server for every lane (identical serving): serve-static + gzip (compression), no framework server.
//   node harness/static-server.mjs <site root> <port>
// Directories → index.html (trailing-slash redirect), missing → 404.html when present. Cache-Control: no-cache
// (cold-cache runs use fresh browser contexts anyway).
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import compression from "compression";
import finalhandler from "finalhandler";
import serveStatic from "serve-static";

const root = resolve(process.argv[2]);
const port = Number(process.argv[3] ?? 4410);
const gzip = process.env.EDITORIAL_GZIP !== "0";
const files = serveStatic(root, { index: ["index.html"], redirect: true, cacheControl: true, maxAge: 0, extensions: ["html"] });
const compress = compression();
const notFound = existsSync(join(root, "404.html")) ? readFileSync(join(root, "404.html")) : Buffer.from("Not found");

const server = createServer((req, res) => {
  const done = (err) => {
    if (err) return finalhandler(req, res)(err);
    res.statusCode = 404;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(notFound);
  };
  if (gzip) compress(req, res, () => files(req, res, done));
  else files(req, res, done);
});
server.keepAliveTimeout = 60_000;
server.listen(port, "127.0.0.1", () => console.log(`static ${root} on http://127.0.0.1:${port}`));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.close(() => process.exit(0)));
