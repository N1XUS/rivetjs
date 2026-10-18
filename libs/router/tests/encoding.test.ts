// Node adapter content encodings (M5 E2, docs/design/plans/2026-10-18-derived-client.md): zstd when accepted (level 1 on
// large bodies, 3 below; streamed bodies too), brotli q4 then gzip as fallbacks, immutable client files precompressed at
// the best quality on their first request and written next to the file, `Vary` / `Content-Encoding` on every answer,
// and the opt-outs (`compress: { zstd: false }`, `{ precompress: false }`, `false`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliDecompressSync, gunzipSync, zstdCompressSync, zstdDecompressSync } from "node:zlib";
import { negotiate, serve, type Handler, type ServeOptions } from "../adapters/node.ts";

interface Reply {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
  chunks: number;
}
/** Raw HTTP request (no automatic decompression). */
function get(url: string, headers: Record<string, string> = {}, method = "GET"): Promise<Reply> {
  return new Promise((done, fail) => {
    const { hostname, port, pathname, search } = new URL(url);
    const req = httpRequest({ hostname, port, path: pathname + search, method, headers }, (res) => {
      const parts: Buffer[] = [];
      res.on("data", (chunk: Buffer) => parts.push(chunk));
      res.on("end", () => done({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(parts), chunks: parts.length }));
      res.on("error", fail);
    });
    req.on("error", fail);
    req.end();
  });
}
const decode = (reply: Reply): string => {
  const encoding = reply.headers["content-encoding"];
  const body = reply.body;
  return (
    encoding === "zstd" ? zstdDecompressSync(body) : encoding === "br" ? brotliDecompressSync(body) : encoding === "gzip" ? gunzipSync(body) : body
  ).toString();
};
const until = async (check: () => Promise<boolean>, what: string) => {
  for (let i = 0; i < 200; i++) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 10));
  }
  throw new Error(`timed out: ${what}`);
};

async function withServer(
  handler: Handler,
  fn: (url: string, dir: string) => Promise<void>,
  extra: Partial<Omit<ServeOptions, "handler" | "client" | "port">> = {},
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "rivet-encoding-"));
  await mkdir(join(dir, "assets"));
  await writeFile(join(dir, "assets", "app-1a2b.js"), "console.log('x');".repeat(200));
  await writeFile(join(dir, "robots.txt"), "User-agent: *\n".repeat(100));
  const serving = await serve({ handler, client: dir, port: 0, onError: () => {}, ...extra });
  try {
    await fn(serving.url, dir);
  } finally {
    await serving.close();
    await rm(dir, { recursive: true, force: true });
  }
}

const CHROME = "gzip, deflate, br, zstd";
const SAFARI = "gzip, deflate, br";

test("negotiate: zstd wins a tie with br, q weights and opt-out", () => {
  assert.equal(negotiate(CHROME), "zstd");
  assert.equal(negotiate(SAFARI), "br");
  assert.equal(negotiate("gzip"), "gzip");
  assert.equal(negotiate("zstd;q=0.5, br"), "br");
  assert.equal(negotiate("zstd;q=0, br;q=0, gzip"), "gzip");
  assert.equal(negotiate("*"), "zstd");
  assert.equal(negotiate("identity"), null);
  // The opt-out never picks zstd, with its own memo.
  assert.equal(negotiate(CHROME, false), "br");
  assert.equal(negotiate("zstd", false), null);
  assert.equal(negotiate(CHROME), "zstd");
});

test("dynamic bodies: zstd when accepted (one call below the turn, streamed with flushes after it), br then gzip otherwise, Vary set", async () => {
  const page = "<p>" + "Rivet page body ".repeat(200) + "</p>";
  const big = "<p>" + "Large page body ".repeat(40_000) + "</p>"; // ≈ 640 KB: the large-body level, async one call
  await withServer(
    (request) => {
      const { pathname } = new URL(request.url);
      if (pathname === "/big") return new Response(big, { headers: { "content-type": "text/html; charset=utf-8" } });
      if (pathname === "/json")
        return new Response(JSON.stringify({ rows: Array.from({ length: 200 }, (_, i) => ({ i })) }), { headers: { "content-type": "application/json" } });
      if (pathname === "/stream") {
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            controller.enqueue(encoder.encode(page));
            await new Promise((done) => setTimeout(done, 30));
            controller.enqueue(encoder.encode("<p>late</p>".repeat(100)));
            controller.close();
          },
        });
        return new Response(body, { headers: { "content-type": "text/html; charset=utf-8", vary: "Cookie" } });
      }
      return new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } });
    },
    async (url) => {
      for (const [accept, encoding] of [
        [CHROME, "zstd"],
        [SAFARI, "br"],
        ["gzip", "gzip"],
      ] as const) {
        const reply = await get(url + "/page", { "accept-encoding": accept });
        assert.equal(reply.headers["content-encoding"], encoding, accept);
        assert.equal(reply.headers.vary, "Accept-Encoding");
        assert.ok(reply.headers["content-length"], "one call → Content-Length");
        assert.equal(decode(reply), page);
      }
      const large = await get(url + "/big", { "accept-encoding": CHROME });
      assert.equal(large.headers["content-encoding"], "zstd");
      assert.ok(Number(large.headers["content-length"]) < big.length / 20, "zstd −1 compresses the repetitive page");
      assert.equal(decode(large), big);
      const json = await get(url + "/json", { "accept-encoding": CHROME });
      assert.equal(json.headers["content-encoding"], "zstd");
      assert.equal(JSON.parse(decode(json)).rows.length, 200);
      const streamed = await get(url + "/stream", { "accept-encoding": CHROME });
      assert.equal(streamed.headers["content-encoding"], "zstd");
      assert.equal(streamed.headers.vary, "Cookie, Accept-Encoding");
      assert.equal(streamed.headers["transfer-encoding"], "chunked");
      assert.ok(streamed.chunks >= 2, "per-chunk flush: the shell arrives before the late part");
      assert.equal(decode(streamed), page + "<p>late</p>".repeat(100));
      const head = await get(url + "/page", { "accept-encoding": CHROME }, "HEAD");
      assert.equal(head.headers.vary, "Accept-Encoding");
      assert.equal(head.body.length, 0);
      const identity = await get(url + "/page", { "accept-encoding": "identity" });
      assert.equal(identity.headers["content-encoding"], undefined);
      assert.equal(identity.body.toString(), page);
    },
  );
});

test("rendered pages (direct bodies) go out as zstd: complete ones in one call, pending ones streamed", async () => {
  const { renderDocument } = await import("../server/render.ts");
  const document = () => ({ start: "<!doctype html><body>", end: "</body>" });
  const input = { head: undefined, nonce: undefined, url: new URL("http://x/"), status: 200, styles: [] };
  const row = "z".repeat(1000) + "\n"; // text children (escaped): no markup
  let release!: (value: string) => void;
  await withServer(
    (request) => {
      const path = new URL(request.url).pathname;
      const factory =
        path === "/pending"
          ? () => ["shell", new Promise<string>((done) => (release = done)), Array.from({ length: 200 }, () => row)]
          : () => Array.from({ length: path === "/big" ? 700 : 3 }, () => row);
      return renderDocument(factory as never, input, { document }, { status: 200, headers: new Headers() });
    },
    async (url) => {
      for (const path of ["/small", "/big"]) {
        const expected = "<!doctype html><body>" + row.repeat(path === "/big" ? 700 : 3) + "</body>";
        const packed = await get(url + path, { "accept-encoding": CHROME });
        assert.equal(packed.headers["content-encoding"], "zstd");
        assert.equal(packed.headers["content-length"], String(packed.body.length), "one compression call");
        assert.equal(packed.headers.vary, "Accept-Encoding");
        assert.equal(decode(packed), expected);
        const br = await get(url + path, { "accept-encoding": SAFARI });
        assert.equal(br.headers["content-encoding"], "br");
        assert.equal(decode(br), expected);
      }
      const pending = get(url + "/pending", { "accept-encoding": CHROME });
      await new Promise((done) => setTimeout(done, 50));
      release("late");
      const reply = await pending;
      assert.equal(reply.headers["content-encoding"], "zstd");
      assert.equal(reply.headers["content-length"], undefined);
      assert.equal(decode(reply), "<!doctype html><body>shelllate" + row.repeat(200) + "</body>");
      assert.ok(reply.chunks >= 2, "shell flushed before the late content");
    },
  );
});

for (const mode of ["index", "fs"] as const)
  test(`immutable client files are precompressed at the best quality on their first request and written to disk (static: ${mode})`, async () => {
    await withServer(
      () => new Response("app", { status: 404 }),
      async (url, dir) => {
        const source = "console.log('x');".repeat(200);
        const first = await get(url + "/assets/app-1a2b.js", { "accept-encoding": CHROME });
        assert.equal(first.status, 200);
        assert.equal(first.headers["content-encoding"], "zstd");
        assert.equal(first.headers["cache-control"], "public, max-age=31536000, immutable");
        assert.equal(first.headers.vary, "Accept-Encoding");
        assert.equal(decode(first), source);
        // Written next to the file (the served bytes, zstd 19), the hidden temp gone.
        await until(
          () =>
            readFile(join(dir, "assets", "app-1a2b.js.zst")).then(
              () => true,
              () => false,
            ),
          ".zst sibling written",
        );
        assert.deepEqual(await readFile(join(dir, "assets", "app-1a2b.js.zst")), first.body, "the sibling holds the served bytes");
        assert.ok(first.body.length <= zstdCompressSync(source, { params: { 100: 19 } }).length, "best quality");
        assert.deepEqual((await readdir(join(dir, "assets"))).sort(), ["app-1a2b.js", "app-1a2b.js.zst"]);
        const br = await get(url + "/assets/app-1a2b.js", { "accept-encoding": SAFARI });
        assert.equal(br.headers["content-encoding"], "br");
        assert.equal(decode(br), source);
        await until(
          () =>
            readFile(join(dir, "assets", "app-1a2b.js.br")).then(
              () => true,
              () => false,
            ),
          ".br sibling written",
        );
        const gz = await get(url + "/assets/app-1a2b.js", { "accept-encoding": "gzip" });
        assert.equal(gz.headers["content-encoding"], "gzip");
        assert.equal(decode(gz), source);
        await until(
          () =>
            readFile(join(dir, "assets", "app-1a2b.js.gz")).then(
              () => true,
              () => false,
            ),
          ".gz sibling written",
        );
        // Revalidation answers keep the Vary; the body stays decodable on later requests (served from memory / the sibling).
        const again = await get(url + "/assets/app-1a2b.js", { "accept-encoding": CHROME });
        assert.equal(decode(again), source);
        assert.equal((await get(url + "/assets/app-1a2b.js", { "if-none-match": first.headers.etag as string, "accept-encoding": CHROME })).status, 304);
        // A mutable file (no-cache) is compressed in memory only: nothing is written next to it.
        const robots = await get(url + "/robots.txt", { "accept-encoding": CHROME });
        assert.equal(robots.headers["content-encoding"], "zstd");
        assert.equal(robots.headers["cache-control"], "no-cache");
        assert.equal(decode(robots), "User-agent: *\n".repeat(100));
        await new Promise((done) => setTimeout(done, 50));
        assert.deepEqual(
          (await readdir(dir)).filter((name) => name.startsWith("robots")),
          ["robots.txt"],
        );
      },
      { static: mode },
    );
  });

test("a precompressed sibling written by an earlier process is served as it is", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rivet-encoding-"));
  await mkdir(join(dir, "assets"));
  await writeFile(join(dir, "assets", "a-1.css"), "body{color:red}".repeat(100));
  // A different body proves the sibling (not an on-the-fly compression) was sent.
  await writeFile(join(dir, "assets", "a-1.css.zst"), zstdCompressSync("precompressed"));
  const serving = await serve({ handler: () => new Response("app", { status: 404 }), client: dir, port: 0 });
  try {
    const reply = await get(serving.url + "/assets/a-1.css", { "accept-encoding": CHROME });
    assert.equal(reply.headers["content-encoding"], "zstd");
    assert.equal(decode(reply), "precompressed");
    assert.deepEqual((await readdir(join(dir, "assets"))).sort(), ["a-1.css", "a-1.css.zst"]);
  } finally {
    await serving.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("opt-outs: { zstd: false } answers brotli, { precompress: false } writes nothing, false compresses nothing", async () => {
  const page = "<p>" + "Rivet page body ".repeat(200) + "</p>";
  const handler: Handler = () => new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } });
  await withServer(
    handler,
    async (url, dir) => {
      const reply = await get(url + "/page", { "accept-encoding": CHROME });
      assert.equal(reply.headers["content-encoding"], "br");
      assert.equal(decode(reply), page);
      const asset = await get(url + "/assets/app-1a2b.js", { "accept-encoding": CHROME });
      assert.equal(asset.headers["content-encoding"], "br");
      await until(
        () =>
          readFile(join(dir, "assets", "app-1a2b.js.br")).then(
            () => true,
            () => false,
          ),
        ".br sibling written",
      );
      assert.deepEqual((await readdir(join(dir, "assets"))).sort(), ["app-1a2b.js", "app-1a2b.js.br"]);
    },
    { compress: { zstd: false } },
  );
  await withServer(
    handler,
    async (url, dir) => {
      const asset = await get(url + "/assets/app-1a2b.js", { "accept-encoding": CHROME });
      assert.equal(asset.headers["content-encoding"], "zstd");
      assert.equal(decode(asset), "console.log('x');".repeat(200));
      await new Promise((done) => setTimeout(done, 50));
      assert.deepEqual(await readdir(join(dir, "assets")), ["app-1a2b.js"]);
      assert.equal((await get(url + "/page", { "accept-encoding": CHROME })).headers["content-encoding"], "zstd");
    },
    { compress: { precompress: false } },
  );
  await withServer(
    handler,
    async (url, dir) => {
      const reply = await get(url + "/page", { "accept-encoding": CHROME });
      assert.equal(reply.headers["content-encoding"], undefined);
      assert.equal(reply.headers.vary, undefined);
      assert.equal(reply.body.toString(), page);
      const asset = await get(url + "/assets/app-1a2b.js", { "accept-encoding": CHROME });
      assert.equal(asset.headers["content-encoding"], undefined);
      await new Promise((done) => setTimeout(done, 50));
      assert.deepEqual(await readdir(join(dir, "assets")), ["app-1a2b.js"]);
    },
    { compress: false },
  );
});

test("an unwritable client directory keeps the compressed copy in memory and still answers", async () => {
  await withServer(
    () => new Response("app", { status: 404 }),
    async (url, dir) => {
      // The sibling's name is taken by a directory: the rename fails, the temp is removed, the answer is unaffected.
      await mkdir(join(dir, "assets", "app-1a2b.js.zst"));
      const first = await get(url + "/assets/app-1a2b.js", { "accept-encoding": CHROME });
      assert.equal(first.headers["content-encoding"], "zstd");
      assert.equal(decode(first), "console.log('x');".repeat(200));
      await new Promise((done) => setTimeout(done, 50));
      assert.deepEqual((await readdir(join(dir, "assets"))).sort(), ["app-1a2b.js", "app-1a2b.js.zst"]);
      const again = await get(url + "/assets/app-1a2b.js", { "accept-encoding": CHROME });
      assert.equal(decode(again), "console.log('x');".repeat(200));
    },
    { static: "fs" },
  );
});
