// Node adapter hardening (review round 2): request targets never pick the origin, malformed Host →
// 400, unread request bodies do not stall keep-alive, static files: `.well-known`, single byte
// ranges, `If-None-Match` lists, `Last-Modified` / `If-Modified-Since`, `negotiate` by q.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { byteRange, etagMatches, negotiate, serve, type Handler, type ServeOptions } from "../adapters/node.ts";

/** Raw HTTP/1.1 exchange on one socket: write `raw`, collect until `responses` responses (by status line) arrived or the socket closed. */
function exchange(url: string, raw: string | Buffer[], responses = 1): Promise<string> {
  const { port } = new URL(url);
  return new Promise((done, fail) => {
    const socket = connect(Number(port), "127.0.0.1");
    let text = "";
    const timer = setTimeout(() => (socket.destroy(), done(text)), 1500);
    socket.on("data", (chunk) => {
      text += chunk.toString("latin1");
      if ((text.match(/^HTTP\/1\.1 \d{3}/gm)?.length ?? 0) >= responses && /\r\n\r\n/.test(text.slice(text.lastIndexOf("HTTP/1.1")))) {
        // Let the last body arrive.
        setTimeout(() => (clearTimeout(timer), socket.destroy(), done(text)), 30);
      }
    });
    socket.on("error", fail);
    socket.on("close", () => (clearTimeout(timer), done(text)));
    if (typeof raw === "string") socket.write(raw);
    else for (const part of raw) socket.write(part);
  });
}

async function withServer(handler: Handler, fn: (url: string, dir: string) => Promise<void>, extra: Partial<ServeOptions> = {}) {
  const dir = await mkdtemp(join(tmpdir(), "rivet-node-h-"));
  await mkdir(join(dir, ".well-known"));
  await writeFile(join(dir, ".well-known", "security.txt"), "Contact: mailto:security@example.test");
  await mkdir(join(dir, "media"));
  await mkdir(join(dir, "media", ".well-known"));
  await writeFile(join(dir, "media", ".well-known", "x.txt"), "nested");
  await writeFile(join(dir, "media", "clip.bin"), Buffer.from(Array.from({ length: 100 }, (_, i) => i)));
  const serving = await serve({ handler, client: dir, port: 0, onError: () => {}, ...extra });
  try {
    await fn(serving.url, dir);
  } finally {
    await serving.close();
    await rm(dir, { recursive: true, force: true });
  }
}
const echo: Handler = (request) => new Response(new URL(request.url).href);

test("U5: with a fixed origin, absolute-form targets for another host get 400; the URL never takes the target's host", async () => {
  await withServer(
    echo,
    async (url) => {
      const foreign = await exchange(url, "GET http://evil.test/reset HTTP/1.1\r\nHost: shop.example\r\nConnection: close\r\n\r\n");
      assert.match(foreign, /^HTTP\/1\.1 400/);
      const own = await exchange(url, "GET https://shop.example/a?b=1 HTTP/1.1\r\nHost: whatever\r\nConnection: close\r\n\r\n");
      assert.match(own, /^HTTP\/1\.1 200/);
      assert.match(own, /\r\n\r\n(?:[\da-f]+\r\n)?https:\/\/shop\.example\/a\?b=1/);
      // `//host/x` origin-form: a path on this origin.
      const slashes = await exchange(url, "GET //evil.test/x HTTP/1.1\r\nHost: shop.example\r\nConnection: close\r\n\r\n");
      assert.match(slashes, /https:\/\/shop\.example\/\/evil\.test\/x/);
      assert.doesNotMatch(slashes, /https:\/\/evil\.test/);
    },
    { origin: "https://shop.example" },
  );
});

test("SEC9: a malformed Host answers 400 without reaching the handler or the error log", async () => {
  let hits = 0;
  const errors: unknown[] = [];
  await withServer(
    () => (hits++, new Response("app")),
    async (url) => {
      for (const host of ["user@evil.test", "evil.test/@x", "a b", "evil.test:99999x", ""]) {
        const reply = await exchange(url, `GET /page HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`);
        assert.match(reply, /^HTTP\/1\.1 400/, JSON.stringify(host));
      }
      assert.match(await exchange(url, "GET /page HTTP/1.1\r\nHost: localhost:3000\r\nConnection: close\r\n\r\n"), /^HTTP\/1\.1 200/);
      assert.match(await exchange(url, "GET /page HTTP/1.1\r\nHost: [::1]:8080\r\nConnection: close\r\n\r\n"), /^HTTP\/1\.1 200/);
      assert.equal(hits, 2);
    },
    { onError: (e) => errors.push(e) },
  );
  assert.deepEqual(errors, []);
});

test("U8: a large request body the handler never reads does not stall the keep-alive connection", async () => {
  await withServer(
    (request) => (request.method === "POST" ? new Response("rejected", { status: 403 }) : new Response("next")),
    async (url) => {
      const size = 200 * 1024;
      const head = `POST /form HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/octet-stream\r\nContent-Length: ${size}\r\n\r\n`;
      const reply = await exchange(
        url,
        [Buffer.from(head), Buffer.alloc(size, 120), Buffer.from("GET /after HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")],
        2,
      );
      assert.match(reply, /^HTTP\/1\.1 403/);
      assert.match(reply, /HTTP\/1\.1 200[\s\S]*next/, "the pipelined GET is answered");
    },
  );
});

test("C13: .well-known is served at the root only; single byte ranges; validators", async () => {
  await withServer(echo, async (url) => {
    const security = await fetch(url + "/.well-known/security.txt");
    assert.equal(security.status, 200);
    assert.equal(await security.text(), "Contact: mailto:security@example.test");
    assert.match(await (await fetch(url + "/media/.well-known/x.txt")).text(), /^http:/, "nested .well-known is not a file");

    const full = await fetch(url + "/media/clip.bin");
    assert.equal(full.headers.get("accept-ranges"), "bytes");
    const modified = full.headers.get("last-modified")!;
    assert.ok(modified && !Number.isNaN(Date.parse(modified)));
    const etag = full.headers.get("etag")!;

    const part = await fetch(url + "/media/clip.bin", { headers: { range: "bytes=10-19" } });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get("content-range"), "bytes 10-19/100");
    assert.deepEqual([...new Uint8Array(await part.arrayBuffer())], [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    const suffix = await fetch(url + "/media/clip.bin", { headers: { range: "bytes=-3" } });
    assert.deepEqual([...new Uint8Array(await suffix.arrayBuffer())], [97, 98, 99]);
    const open = await fetch(url + "/media/clip.bin", { headers: { range: "bytes=98-" } });
    assert.equal(open.headers.get("content-range"), "bytes 98-99/100");
    const beyond = await fetch(url + "/media/clip.bin", { headers: { range: "bytes=500-" } });
    assert.equal(beyond.status, 416);
    assert.equal(beyond.headers.get("content-range"), "bytes */100");
    assert.equal((await fetch(url + "/media/clip.bin", { headers: { range: "bytes=0-1,5-6" } })).status, 200, "several ranges: whole file");
    assert.equal((await fetch(url + "/media/clip.bin", { headers: { range: "bytes=0-1", "if-range": "Thu, 01 Jan 1970 00:00:00 GMT" } })).status, 200);
    assert.equal((await fetch(url + "/media/clip.bin", { headers: { range: "bytes=0-1", "if-range": modified } })).status, 206);

    assert.equal((await fetch(url + "/media/clip.bin", { headers: { "if-none-match": `"other", ${etag}` } })).status, 304);
    assert.equal((await fetch(url + "/media/clip.bin", { headers: { "if-none-match": etag.slice(2) } })).status, 304, "weak comparison");
    assert.equal((await fetch(url + "/media/clip.bin", { headers: { "if-none-match": "*" } })).status, 304);
    assert.equal((await fetch(url + "/media/clip.bin", { headers: { "if-none-match": '"other"' } })).status, 200);
    assert.equal((await fetch(url + "/media/clip.bin", { headers: { "if-modified-since": modified } })).status, 304);
    assert.equal((await fetch(url + "/media/clip.bin", { headers: { "if-modified-since": "Thu, 01 Jan 1970 00:00:00 GMT" } })).status, 200);
    // If-None-Match wins over If-Modified-Since.
    assert.equal((await fetch(url + "/media/clip.bin", { headers: { "if-none-match": '"other"', "if-modified-since": modified } })).status, 200);
  });
});

test("C13: negotiate honours q; validators and ranges parse edge cases", () => {
  assert.equal(negotiate("gzip;q=1, br;q=0.1"), "gzip");
  assert.equal(negotiate("gzip;q=0.5, br;q=0.5"), "br");
  assert.equal(negotiate("br, gzip"), "br");
  assert.equal(negotiate("*;q=0.2, gzip;q=0.8"), "gzip");
  assert.equal(etagMatches('W/"a", "b"', '"b"'), true);
  assert.equal(etagMatches(undefined, '"b"'), false);
  assert.deepEqual(byteRange("bytes=0-0", 1), [0, 0]);
  assert.deepEqual(byteRange("bytes=5-1000", 10), [5, 9]);
  assert.equal(byteRange("bytes=-0", 10), "unsatisfiable");
  assert.equal(byteRange("items=0-1", 10), null);
  assert.equal(byteRange("bytes=7-3", 10), null);
});
