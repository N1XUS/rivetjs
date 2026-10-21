import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliCompressSync, brotliDecompressSync, gunzipSync } from "node:zlib";
import { negotiate, serve, type Handler } from "../adapters/node.ts";

interface Reply {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
  chunks: { at: number; size: number }[];
}
/** Raw HTTP request (no automatic decompression) recording chunk arrival times. */
function get(url: string, headers: Record<string, string> = {}, method = "GET"): Promise<Reply> {
  return new Promise((done, fail) => {
    const start = Date.now();
    // Raw path: URL parsing would normalize dot segments before they reach the server.
    const { origin, pathname } = /^(?<origin>https?:\/\/[^/]+)(?<pathname>.*)$/.exec(url)!.groups!;
    const { hostname, port } = new URL(origin);
    const req = httpRequest({ hostname, port, path: pathname || "/", method, headers }, (res) => {
      const parts: Buffer[] = [],
        chunks: Reply["chunks"] = [];
      res.on("data", (chunk: Buffer) => {
        parts.push(chunk);
        chunks.push({ at: Date.now() - start, size: chunk.length });
      });
      res.on("end", () => done({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(parts), chunks }));
      res.on("error", fail);
    });
    req.on("error", fail);
    req.end();
  });
}

async function withServer(handler: Handler, fn: (url: string, dir: string) => Promise<void>, extra: { grace?: number; static?: "index" | "fs" } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "rivet-node-"));
  await mkdir(join(dir, "assets"));
  await writeFile(join(dir, "assets", "app-1a2b.js"), "console.log('x');".repeat(200));
  await writeFile(join(dir, "robots.txt"), "User-agent: *");
  await writeFile(join(dir, ".env"), "SECRET=1");
  // Symlinks: one escaping the directory (never served), one inside it (served).
  await symlink("/etc/hosts", join(dir, "assets", "link"));
  await symlink(join(dir, "robots.txt"), join(dir, "assets", "robots-alias.txt"));
  await mkdir(join(dir, ".git"));
  await writeFile(join(dir, ".git", "config"), "secret");
  const errors: unknown[] = [];
  const serving = await serve({ handler, client: dir, port: 0, onError: (e) => errors.push(e), ...extra });
  try {
    await fn(serving.url, dir);
  } finally {
    await serving.close();
    await rm(dir, { recursive: true, force: true });
  }
  return errors;
}

test("negotiate prefers zstd, then br, honours q=0 and wildcards", () => {
  assert.equal(negotiate("gzip, deflate, br"), "br");
  assert.equal(negotiate("gzip, deflate, br, zstd"), "zstd");
  assert.equal(negotiate("gzip"), "gzip");
  assert.equal(negotiate("br;q=0, gzip;q=0.5"), "gzip");
  assert.equal(negotiate("*"), "zstd");
  assert.equal(negotiate("identity"), null);
  assert.equal(negotiate(undefined), null);
  // Memoised per header string (bounded): repeated and past-the-cap headers answer the same.
  assert.equal(negotiate("identity"), null);
  for (let i = 0; i < 100; i++) assert.equal(negotiate(`br;q=0.${i % 10}, gzip;q=0.5, x-${i}`), i % 10 >= 5 ? "br" : "gzip");
  assert.equal(negotiate("gzip, deflate, br"), "br");
});

for (const mode of ["index", "fs"] as const)
  test(`hashed assets are immutable and compressed; other files revalidate; dotfiles and escapes are not served (static: ${mode})`, async () => {
    const hits: string[] = [];
    await withServer(
      (request) => {
        hits.push(new URL(request.url).pathname);
        return new Response("app", { status: 404 });
      },
      async (url, dir) => {
        const asset = await get(url + "/assets/app-1a2b.js", { "accept-encoding": "br" });
        assert.equal(asset.status, 200);
        assert.equal(asset.headers["cache-control"], "public, max-age=31536000, immutable");
        assert.equal(asset.headers["content-encoding"], "br");
        assert.equal(brotliDecompressSync(asset.body).toString(), "console.log('x');".repeat(200));
        const etag = asset.headers.etag as string;
        assert.equal((await get(url + "/assets/app-1a2b.js", { "if-none-match": etag })).status, 304);
        const gz = await get(url + "/assets/app-1a2b.js", { "accept-encoding": "gzip" });
        assert.equal(gunzipSync(gz.body).length, 3400);
        const robots = await get(url + "/robots.txt", { "accept-encoding": "br" });
        assert.equal(robots.headers["cache-control"], "no-cache");
        assert.equal(robots.headers["content-encoding"], undefined, "below compression threshold");
        assert.equal(robots.body.toString(), "User-agent: *");
        for (const path of ["/.env", "/assets/link", "/%2e%2e/%2e%2e/etc/hosts", "/assets/%00", "/.git/config", "/%2egit/config", "/assets"]) {
          assert.equal((await get(url + path)).status, 404, path);
        }
        // Refused as files, then handled by the app; the web Request URL normalizes dot segments.
        assert.deepEqual(hits.sort(), ["/%2egit/config", "/.env", "/.git/config", "/assets", "/assets/%00", "/assets/link", "/etc/hosts"]);
        assert.equal((await get(url + "/assets/robots-alias.txt")).body.toString(), "User-agent: *");
        assert.equal((await get(url + "//assets//robots-alias.txt")).status, 200);
        const head = await get(url + "/assets/app-1a2b.js", {}, "HEAD");
        assert.equal(head.body.length, 0);
        assert.equal(head.headers["content-length"], "3400");
        // Files added after start: the index does not know them; fs mode looks each request up.
        await writeFile(join(dir, "late.txt"), "late");
        assert.equal((await get(url + "/late.txt")).status, mode === "fs" ? 200 : 404);
      },
      { static: mode },
    );
  });

test("static index: precompressed siblings found at start are served", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rivet-node-"));
  const source = "body{color:red}".repeat(100);
  await writeFile(join(dir, "a.css"), source);
  // A different body proves the sibling (not an on-the-fly compression) was sent.
  await writeFile(join(dir, "a.css.br"), brotliCompressSync("precompressed"));
  const serving = await serve({ handler: () => new Response("app", { status: 404 }), client: dir, port: 0 });
  try {
    const reply = await get(serving.url + "/a.css", { "accept-encoding": "br" });
    assert.equal(reply.headers["content-encoding"], "br");
    assert.equal(brotliDecompressSync(reply.body).toString(), "precompressed");
  } finally {
    await serving.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("streamed handler bodies are compressed with per-chunk flush and keep headers/cookies", async () => {
  await withServer(
    () => {
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(encoder.encode("<!doctype html><p>shell</p>" + " ".repeat(2048)));
          await new Promise((r) => setTimeout(r, 150));
          controller.enqueue(encoder.encode("<p>late</p>"));
          controller.close();
        },
      });
      const headers = new Headers({ "content-type": "text/html; charset=utf-8", "x-route": "home" });
      headers.append("set-cookie", "a=1; Path=/");
      headers.append("set-cookie", "b=2; Path=/");
      return new Response(body, { status: 201, headers });
    },
    async (url) => {
      const reply = await get(url + "/page", { "accept-encoding": "br" });
      assert.equal(reply.status, 201);
      assert.equal(reply.headers["x-route"], "home");
      assert.deepEqual(reply.headers["set-cookie"], ["a=1; Path=/", "b=2; Path=/"]);
      assert.equal(reply.headers["x-content-type-options"], "nosniff");
      assert.equal(reply.headers["content-encoding"], "br");
      assert.match(brotliDecompressSync(reply.body).toString(), /shell<\/p>\s+<p>late<\/p>$/);
      assert.ok(reply.chunks.length >= 2, "shell flushed before the late chunk");
      assert.ok(reply.chunks[0].at < 120, `first chunk at ${reply.chunks[0].at}ms`);
    },
  );
});

test("bodies complete before the event loop turns go out in one write, compressed in one call", async () => {
  const page = "<!doctype html><p>" + "rivet ".repeat(400) + "</p>";
  await withServer(
    (request) => {
      const small = new URL(request.url).pathname === "/small";
      const encoder = new TextEncoder();
      // Several synchronous chunks, like a server render.
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const part of small ? ["<p>hi</p>"] : [page.slice(0, 100), page.slice(100)]) controller.enqueue(encoder.encode(part));
          controller.close();
        },
      });
      return new Response(body, { headers: { "content-type": "text/html; charset=utf-8", vary: "Cookie" } });
    },
    async (url) => {
      for (const encoding of ["br", "gzip"] as const) {
        const reply = await get(url + "/page", { "accept-encoding": encoding });
        assert.equal(reply.headers["content-encoding"], encoding);
        assert.equal(reply.headers["content-length"], String(reply.body.length));
        assert.equal(reply.headers.vary, "Cookie, Accept-Encoding");
        assert.equal((encoding === "br" ? brotliDecompressSync(reply.body) : gunzipSync(reply.body)).toString(), page);
      }
      const plain = await get(url + "/page", {});
      assert.equal(plain.headers["content-encoding"], undefined);
      assert.equal(plain.body.toString(), page);
      // Below the compression threshold: sent as is (the response still varies by encoding).
      const small = await get(url + "/small", { "accept-encoding": "br" });
      assert.equal(small.headers["content-encoding"], undefined);
      assert.equal(small.headers["content-length"], "9");
      assert.equal(small.headers.vary, "Cookie, Accept-Encoding");
      assert.equal(small.body.toString(), "<p>hi</p>");
    },
  );
});

// Rendered pages (renderDocument) skip the web stream: the adapter takes the renderer's slab views
// directly (server/body.ts). Content-Length for bodies complete when attached (one corked write) or, compressed,
// before the event loop turns (one compression call); an uncompressed body still rendering (past the 64 KiB
// queue, pending content) sends headers + its head at once (early bytes), the rest chunked.
test("rendered pages go out directly: small bodies with Content-Length, large plain ones head first (chunked), compressed in one call, pending ones streamed", async () => {
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
        const rows = path === "/big" ? 700 : 3;
        const expected = "<!doctype html><body>" + row.repeat(rows) + "</body>";
        const plain = await get(url + path);
        // Past the renderer's 64 KiB queue the Response exists before the render ends: early bytes, chunked.
        assert.equal(plain.headers["content-length"], path === "/big" ? undefined : String(expected.length), path);
        assert.equal(plain.headers["transfer-encoding"], path === "/big" ? "chunked" : undefined, path);
        assert.equal(plain.body.toString(), expected);
        const packed = await get(url + path, { "accept-encoding": "br" });
        assert.equal(packed.headers["content-encoding"], "br");
        assert.equal(packed.headers["content-length"], String(packed.body.length));
        assert.equal(brotliDecompressSync(packed.body).toString(), expected);
      }
      // Several requests reuse the pooled slabs: bodies stay intact.
      const again = await Promise.all(Array.from({ length: 4 }, () => get(url + "/big")));
      for (const reply of again) assert.equal(reply.body.toString(), "<!doctype html><body>" + row.repeat(700) + "</body>");
      for (const encoding of [null, "gzip"] as const) {
        const pending = get(url + "/pending", encoding ? { "accept-encoding": encoding } : {});
        await new Promise((done) => setTimeout(done, 50));
        release("late");
        const reply = await pending;
        assert.equal(reply.headers["content-length"], undefined);
        const text = (encoding ? gunzipSync(reply.body) : reply.body).toString();
        assert.equal(text, "<!doctype html><body>shelllate" + row.repeat(200) + "</body>");
        assert.ok(reply.chunks.length >= 2, "shell before the late content");
      }
    },
  );
});

// LAZY-FLIP 2026-10-21: a client that stops reading and leaves while a rendered page waits on the socket's backpressure
// rejected the adapter's write wait; the renderer's scheduled flush (and the attach-time wait) dropped that promise, so
// the rejection was unhandled (default Node: the server process exits).
test("a client gone while a streamed page waits on backpressure leaves no unhandled rejection; the server keeps serving", async () => {
  const { renderDocument } = await import("../server/render.ts");
  const document = () => ({ start: "<!doctype html><body>", end: "</body>" });
  const input = { head: undefined, nonce: undefined, url: new URL("http://x/"), status: 200, styles: [] };
  const row = "w".repeat(1000) + "\n";
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => void unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  try {
    await withServer(
      (request) =>
        new URL(request.url).pathname === "/ok"
          ? new Response("ok")
          : renderDocument(
              // Shell, then ~8 MB in async holes below the flush size: each lands in a scheduled flush (microtask), the
              // way a page with many async boundaries streams, into a socket nobody reads.
              (() => ["shell", Array.from({ length: 800 }, () => Promise.resolve(row.repeat(10)))]) as never,
              input,
              { document },
              { status: 200, headers: new Headers() },
            ),
      async (url) => {
        for (let i = 0; i < 3; i++)
          await new Promise<void>((done) => {
            const req = httpRequest(url + "/big", (res) => {
              res.once("data", () => {
                res.pause();
                // The renderer fills the socket buffers and waits; then the client goes away.
                setTimeout(() => (req.destroy(), done()), 150);
              });
            });
            req.on("error", () => done());
            req.end();
          });
        await new Promise((done) => setTimeout(done, 200));
        assert.equal((await get(url + "/ok")).body.toString(), "ok");
      },
    );
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
  assert.deepEqual(
    unhandled.map((e) => String((e as Error)?.message ?? e)),
    [],
  );
});

// Early bytes: a long synchronous render's head is on the socket while the rest still renders (TTFB = document
// head, not the whole page); status and headers were final before (the Response existed). Compressed bodies
// keep one compression call.
test("a large synchronous page writes its head to the socket before the render ends (uncompressed)", async () => {
  const { renderDocument } = await import("../server/render.ts");
  const document = () => ({ start: "<!doctype html><body>", end: "</body>" });
  const input = { head: undefined, nonce: undefined, url: new URL("http://x/"), status: 200, styles: [] };
  const row = "y".repeat(1000) + "\n";
  const sockets: import("node:net").Socket[] = [];
  let written = -1;
  const serving = await serve({
    port: 0,
    handler: () => {
      // Keep-alive: the connection's earlier responses count too.
      const socket = sockets.at(-1)!,
        before = socket.bytesWritten;
      return renderDocument(
        // Row 600 (~600 KB in, far past the 64 KiB queue) records what already reached the socket.
        (() => Array.from({ length: 700 }, (_, i) => (i === 600 ? () => ((written = socket.bytesWritten - before), row) : row))) as never,
        input,
        { document },
        { status: 201, headers: new Headers({ "x-page": "big" }) },
      );
    },
  });
  serving.server.on("connection", (socket) => sockets.push(socket));
  try {
    const plain = await get(serving.url + "/big");
    assert.equal(plain.status, 201);
    assert.equal(plain.headers["x-page"], "big");
    assert.equal(plain.body.toString(), "<!doctype html><body>" + row.repeat(700) + "</body>");
    assert.ok(written > 16 * 1024, `head on the socket mid-render (${written} bytes)`);
    written = -1;
    const packed = await get(serving.url + "/big", { "accept-encoding": "gzip" });
    assert.equal(packed.headers["content-length"], String(packed.body.length));
    assert.equal(gunzipSync(packed.body).toString(), "<!doctype html><body>" + row.repeat(700) + "</body>");
    assert.equal(written, 0, "compressed: nothing written before the one-call compression");
  } finally {
    await serving.close();
  }
});

test("handler failures become 500 and are reported; request bodies and nonces reach the handler", async () => {
  const nonces = new Set<string>();
  const errors = await withServer(
    async (request, context) => {
      nonces.add(context.nonce);
      if (request.method === "POST") return new Response("got " + (await request.text()));
      throw new Error("boom");
    },
    async (url) => {
      assert.equal((await get(url + "/x")).status, 500);
      const posted = await new Promise<string>((done, fail) => {
        const req = httpRequest(url + "/form", { method: "POST" }, (res) => {
          let text = "";
          res.on("data", (c: Buffer) => (text += c));
          res.on("end", () => done(text));
        });
        req.on("error", fail);
        req.end("a=1");
      });
      assert.equal(posted, "got a=1");
    },
  );
  assert.equal(errors.length, 1);
  assert.match(String(errors[0]), /boom/);
  assert.equal(nonces.size, 2);
  for (const nonce of nonces) assert.match(nonce, /^[A-Za-z0-9+/]{22}==$/);
});

test("health, readiness and graceful drain of in-flight requests", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rivet-node-"));
  let release: () => void = () => {};
  const gate = new Promise<void>((done) => (release = done));
  const serving = await serve({
    port: 0,
    client: dir,
    handler: async () => {
      await gate;
      return new Response("finished");
    },
  });
  try {
    assert.equal((await get(serving.url + "/healthz")).body.toString(), "ok");
    assert.equal((await get(serving.url + "/readyz")).status, 200);
    const slow = get(serving.url + "/slow");
    await new Promise((r) => setTimeout(r, 50));
    const closed = serving.close();
    setTimeout(release, 50);
    assert.equal((await slow).body.toString(), "finished");
    await closed;
    await assert.rejects(get(serving.url + "/healthz"));
  } finally {
    await serving.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("base headers are not sent twice when the response sets them (any case); the response's value wins", async () => {
  const handler: Handler = () =>
    new Response("{}", { headers: { "content-type": "application/json", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" } });
  await withServer(handler, async (url) => {
    const reply = await get(url + "/data");
    assert.equal(reply.headers["x-content-type-options"], "nosniff");
    assert.equal(reply.headers["referrer-policy"], "no-referrer");
  });
});

test("a `headers` option replaces the default of the same name in any case", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rivet-node-"));
  const serving = await serve({ handler: () => new Response("ok"), client: dir, port: 0, headers: { "referrer-policy": "no-referrer" } });
  try {
    const reply = await get(serving.url + "/");
    assert.equal(reply.headers["referrer-policy"], "no-referrer");
    assert.equal(reply.headers["x-content-type-options"], "nosniff");
  } finally {
    await serving.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("a client that goes away mid-file is not a server error (no report, no 500)", async () => {
  const errors = await withServer(
    () => new Response("page"),
    async (url, dir) => {
      // Uncompressible type (no br/gzip branch) and larger than the socket buffers: the file streams.
      await writeFile(join(dir, "big.bin"), Buffer.alloc(8 * 1024 * 1024, 7));
      // Mid-stream (after the first bytes) and before the server starts the file (socket closed at once).
      for (let i = 0; i < 5; i++)
        await new Promise<void>((done) => {
          const req = httpRequest(url + "/big.bin", (res) => {
            res.once("data", () => {
              req.destroy();
              done();
            });
          });
          req.on("error", () => done());
          req.end();
        });
      for (let i = 0; i < 40; i++)
        await new Promise<void>((done) => {
          const req = httpRequest(url + "/big.bin");
          req.on("error", () => done());
          req.on("socket", (socket) => socket.once("connect", () => setImmediate(() => (req.destroy(), done()))));
          req.end();
        });
      // Give the server time to notice the closed sockets, then check it still serves.
      await new Promise((done) => setTimeout(done, 200));
      assert.equal((await get(url + "/robots.txt")).status, 200);
    },
    { static: "fs" },
  );
  assert.deepEqual(errors, []);
});
