// `serve` content encodings (M5 E2): the docs preview servers (`serveStatic`, `--no-watch`; `serveSwappable`, the watch
// loop) are the router node adapter with compression on, so pages (served by the folder → index.html handler) go out as
// zstd when the client accepts it (brotli / gzip otherwise) and hashed assets are precompressed once at the best quality
// and written next to the file.
import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliDecompressSync, zstdDecompressSync } from "node:zlib";
import { test } from "vitest";
import { serveStatic, serveSwappable } from "../tools/serve.ts";

const PAGE = `<!doctype html><p>home</p>${"<p>Docs page content paragraph.</p>".repeat(100)}<script src="/assets/app-1.js"></script>`;
const ASSET = "console.log(1);".repeat(200);

function writeBuild(dir: string): void {
  mkdirSync(join(dir, "guide"), { recursive: true });
  mkdirSync(join(dir, "assets"), { recursive: true });
  writeFileSync(join(dir, "index.html"), PAGE);
  writeFileSync(join(dir, "guide/index.html"), `<p>guide</p>`);
  writeFileSync(join(dir, "assets/app-1.js"), ASSET);
}

function get(url: string, headers: Record<string, string>): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: Buffer }> {
  return new Promise((done, fail) => {
    const req = request(url, { headers }, (res) => {
      const parts: Buffer[] = [];
      res.on("data", (chunk: Buffer) => parts.push(chunk));
      res.on("end", () => done({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(parts) }));
      res.on("error", fail);
    });
    req.on("error", fail);
    req.end();
  });
}
const until = async (check: () => boolean, what: string) => {
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await new Promise((done) => setTimeout(done, 10));
  }
  throw new Error(`timed out: ${what}`);
};

for (const [name, start] of [
  ["serveStatic", (dir: string) => serveStatic(dir, 0)],
  ["serveSwappable", (dir: string) => serveSwappable(dir, 0)],
] as const)
  test(`${name}: pages go out as zstd (brotli for clients without it), assets are precompressed next to the file`, async () => {
    const dist = mkdtempSync(join(tmpdir(), "docs-kit-encoding-"));
    const client = join(dist, "client");
    writeBuild(client);
    const serving = await start(client);
    try {
      const page = await get(serving.url + "/", { "accept-encoding": "gzip, deflate, br, zstd" });
      assert.equal(page.status, 200);
      assert.equal(page.headers["content-encoding"], "zstd");
      assert.equal(page.headers.vary, "Accept-Encoding");
      assert.equal(zstdDecompressSync(page.body).toString(), PAGE);
      const safari = await get(serving.url + "/", { "accept-encoding": "gzip, deflate, br" });
      assert.equal(safari.headers["content-encoding"], "br");
      assert.equal(brotliDecompressSync(safari.body).toString(), PAGE);
      const asset = await get(serving.url + "/assets/app-1.js", { "accept-encoding": "gzip, deflate, br, zstd" });
      assert.equal(asset.headers["content-encoding"], "zstd");
      assert.equal(asset.headers["cache-control"], "public, max-age=31536000, immutable");
      assert.equal(zstdDecompressSync(asset.body).toString(), ASSET);
      await until(() => existsSync(join(client, "assets/app-1.js.zst")), ".zst sibling written");
      assert.deepEqual(readdirSync(join(client, "assets")).sort(), ["app-1.js", "app-1.js.zst"]);
      // Pages are not immutable: nothing is written next to them.
      assert.deepEqual(readdirSync(client).sort(), ["assets", "guide", "index.html"]);
    } finally {
      await serving.close();
    }
  });
