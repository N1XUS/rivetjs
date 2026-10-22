// Compression Dictionary Transport (RFC 9842, M5 E3): the segment dictionary builder, the static adapter's dictionaries
// (`writeDictionaries` → `_rivet/dict/<id>.dict` + `.vite/rivet-dictionaries.json`), and the node adapter: `Link:
// rel="compression-dictionary"` on HTML pages the browser has no dictionary for, the dictionary file (`Use-As-Dictionary`,
// a year fresh), `dcz` answers (dcz header + zstd with the dictionary) for files, rendered pages (complete and
// streamed), endpoints and stored route-cache pages when `Available-Dictionary` names a dictionary covering the path and
// `Accept-Encoding` takes `dcz`; `Vary: Accept-Encoding, Available-Dictionary`; fallbacks; `{ samples }` (server mode).
import { test } from "vitest";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zstdDecompressSync } from "node:zlib";
import { serve, type Handler, type ServeOptions } from "../adapters/node.ts";
import { buildDictionary, readDictionaries, writeDictionaries } from "../adapters/dictionary.ts";

interface Reply {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
  chunks: number;
}
function get(url: string, headers: Record<string, string> = {}): Promise<Reply> {
  return new Promise((done, fail) => {
    const { hostname, port, pathname, search } = new URL(url);
    const req = httpRequest({ hostname, port, path: pathname + search, headers }, (res) => {
      const parts: Buffer[] = [];
      res.on("data", (chunk: Buffer) => parts.push(chunk));
      res.on("end", () => done({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(parts), chunks: parts.length }));
      res.on("error", fail);
    });
    req.on("error", fail);
    req.end();
  });
}
const sf = (bytes: Buffer) => ":" + createHash("sha256").update(bytes).digest("base64") + ":";
/** Decode a `dcz` body: the 8-byte skippable-frame magic, the dictionary's SHA-256, then zstd with the dictionary. */
function dcz(body: Buffer, dictionary: Buffer): string {
  assert.deepEqual([...body.subarray(0, 8)], [0x5e, 0x2a, 0x4d, 0x18, 0x20, 0, 0, 0]);
  assert.ok(body.subarray(8, 40).equals(createHash("sha256").update(dictionary).digest()), "dcz header names the dictionary");
  return zstdDecompressSync(body.subarray(40), { dictionary }).toString();
}
const CHROME_DICT = "gzip, deflate, br, zstd, dcb, dcz";
const CHROME = "gzip, deflate, br, zstd";

const page = (title: string, body: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><link rel="stylesheet" href="/site.css"></head><body><header class="site"><nav><a href="/docs/">Docs</a><a href="/guides/">Guides</a><a href="/blog/">Blog</a><a href="/about/">About</a></nav></header><main>${body}</main><footer class="site"><p>Copyright Example and contributors. Released under the MIT license.</p></footer></body></html>`;

test("buildDictionary: shared segments, deterministic, capped, never zstd's formatted magic", () => {
  const samples = ["one", "two", "three"].map((name) => Buffer.from(page(name, `<p>${name} unique text of the page ${name.repeat(9)}</p>`)));
  const dictionary = buildDictionary(samples);
  assert.ok(dictionary.length > 200);
  assert.ok(dictionary.toString().includes('<footer class="site">'), "shared chrome kept");
  assert.ok(!dictionary.toString().includes("threethree"), "a segment of one sample is left out");
  assert.ok(buildDictionary(samples).equals(dictionary), "deterministic");
  assert.ok(buildDictionary(samples, { max: 100 }).length <= 100);
  assert.ok(buildDictionary([samples[0]!], { minSamples: 1 }).toString().includes("one unique text"), "minSamples 1 keeps a single sample's segments");
  const magic = Buffer.concat([Buffer.from([0x37, 0xa4, 0x30, 0xec]), Buffer.from(",".repeat(40))]);
  assert.notEqual(buildDictionary([magic, magic])[0], 0x37);
});

async function site(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "rivet-dict-"));
  for (let i = 0; i < 10; i++) {
    await mkdir(join(dir, "docs", `p${i}`), { recursive: true });
    await writeFile(join(dir, "docs", `p${i}`, "index.html"), page(`Doc ${i}`, `<article><h1>Doc ${i}</h1><p>${"lorem ipsum ".repeat(100)}</p></article>`));
    await writeFile(join(dir, "docs", `p${i}`, "_data.json"), JSON.stringify({ data: [{ title: `Doc ${i}`, text: "lorem ipsum ".repeat(100) }] }));
  }
  await mkdir(join(dir, "about"), { recursive: true });
  await writeFile(join(dir, "about", "index.html"), page("About", "<p>About us</p>"));
  await writeFile(join(dir, "index.html"), page("Home", "<p>Welcome home</p>"));
  await mkdir(join(dir, "assets"));
  await writeFile(join(dir, "assets", "app-1a2b.js"), "console.log('x');".repeat(200));
  return dir;
}

test("writeDictionaries: the site's dictionary from the pages and their _data.json; manifest; earlier files removed", async () => {
  const dir = await site();
  try {
    await mkdir(join(dir, "_rivet", "dict"), { recursive: true });
    await writeFile(join(dir, "_rivet", "dict", "old.dict"), "stale");
    const manifest = writeDictionaries(dir, { base: "/app" });
    assert.deepEqual(
      manifest.dictionaries.map((d) => d.prefix),
      ["/app/"],
    );
    for (const entry of manifest.dictionaries) {
      assert.match(entry.url, /^\/app\/_rivet\/dict\/[\da-f]{16}\.dict$/);
      assert.equal(entry.file, entry.url.slice("/app/".length));
    }
    await assert.rejects(readFile(join(dir, "_rivet", "dict", "old.dict")));
    const registry = readDictionaries(dir)!;
    assert.equal(registry.entries.length, 1);
    const entry = registry.entries[0]!;
    assert.equal(entry.use, `match="/app/*", id="${manifest.dictionaries[0]!.id}"`);
    assert.ok(entry.bytes.toString().includes('<footer class="site">'), "page chrome");
    assert.ok(entry.bytes.toString().includes('"text":"lorem ipsum'), "navigation data");
    assert.ok(writeDictionaries(dir, { base: "/app", max: 300 }).dictionaries.length === 1 && readDictionaries(dir)!.entries[0]!.bytes.length <= 300);
    // A file changed after the build no longer matches its id: skipped.
    await writeFile(join(dir, readDictionaries(dir)!.entries[0]!.url.slice("/app/".length)), "edited");
    assert.equal(readDictionaries(dir), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

async function withServer(
  handler: Handler | "pages",
  fn: (url: string, dir: string) => Promise<void>,
  extra: Partial<Omit<ServeOptions, "handler" | "port">> = {},
) {
  const dir = await site();
  const manifest = writeDictionaries(dir);
  // A second, more specific dictionary (`/docs/*`) next to the site's: a registry may hold several (most specific wins).
  const docsBytes = buildDictionary(await Promise.all([0, 2, 4, 6].map((i) => readFile(join(dir, "docs", `p${i}`, "index.html")))));
  const id = createHash("sha256").update(docsBytes).digest().subarray(0, 8).toString("hex");
  await writeFile(join(dir, "_rivet", "dict", id + ".dict"), docsBytes);
  const dictionaries = [{ id, url: `/_rivet/dict/${id}.dict`, prefix: "/docs/", file: `_rivet/dict/${id}.dict` }, ...manifest.dictionaries];
  await writeFile(join(dir, ".vite", "rivet-dictionaries.json"), JSON.stringify({ dictionaries }));
  const own = handler === "pages" ? pages(dir) : handler;
  const serving = await serve({ handler: own, client: dir, port: 0, onError: (error) => console.error(error), ...extra });
  try {
    await fn(serving.url, dir);
  } finally {
    await serving.close();
    await rm(dir, { recursive: true, force: true });
  }
}
/** Folder → `index.html` (as docs-kit serve answers prerendered pages). */
const pages =
  (dir: string): Handler =>
  async (request) => {
    const file = join(dir, new URL(request.url).pathname, "index.html");
    return existsSync(file)
      ? new Response(await readFile(file), { headers: { "content-type": "text/html; charset=utf-8" } })
      : new Response("nope", { status: 404 });
  };

test("static files: Link to the covering dictionary, the dictionary file, dcz answers for pages and _data.json, fallbacks", async () => {
  await withServer("pages", async (url, dir) => {
    const registry = readDictionaries(dir)!;
    const docs = registry.entries[0]!,
      root = registry.entries[1]!;
    // First visit: no dictionary yet → zstd + Link to the most specific dictionary; Vary names Available-Dictionary.
    const first = await get(url + "/docs/p3/", { "accept-encoding": CHROME });
    assert.equal(first.headers["content-encoding"], "zstd");
    assert.equal(first.headers.link, `<${docs.url}>; rel="compression-dictionary"`);
    assert.equal(first.headers.vary, "Accept-Encoding, Available-Dictionary");
    // The dictionary file: immutable, a year fresh (Chromium keeps only fresh dictionaries), Use-As-Dictionary.
    const file = await get(url + docs.url, { "accept-encoding": CHROME });
    assert.equal(file.headers["use-as-dictionary"], `match="/docs/*", id="${docs.id}"`);
    assert.equal(file.headers["cache-control"], "public, max-age=31536000, immutable");
    assert.equal(file.headers["content-encoding"], "zstd");
    assert.ok(zstdDecompressSync(file.body).equals(docs.bytes));
    assert.equal((await get(url + docs.url, { "if-none-match": file.headers.etag as string })).status, 304);
    // Later pages: dcz against the dictionary the browser names; no Link while it has the covering one.
    const html = await readFile(join(dir, "docs", "p5", "index.html"), "utf8");
    const later = await get(url + "/docs/p5/", { "accept-encoding": CHROME_DICT, "available-dictionary": docs.available, "dictionary-id": `"${docs.id}"` });
    assert.equal(later.headers["content-encoding"], "dcz");
    assert.equal(later.headers.vary, "Accept-Encoding, Available-Dictionary");
    assert.equal(later.headers.link, undefined);
    assert.equal(dcz(later.body, docs.bytes), html);
    assert.ok(later.body.length < first.body.length / 2, `dcz ${later.body.length} vs zstd ${first.body.length}`);
    // Navigation data (`_data.json`) under the same prefix.
    const data = await get(url + "/docs/p5/_data.json", { "accept-encoding": CHROME_DICT, "available-dictionary": docs.available });
    assert.equal(data.headers["content-encoding"], "dcz");
    assert.equal(dcz(data.body, docs.bytes), await readFile(join(dir, "docs", "p5", "_data.json"), "utf8"));
    // The site dictionary covers /docs/ too: dcz with it, plus a Link to the more specific one.
    const site = await get(url + "/docs/p6/", { "accept-encoding": CHROME_DICT, "available-dictionary": root.available });
    assert.equal(site.headers["content-encoding"], "dcz");
    assert.equal(dcz(site.body, root.bytes), await readFile(join(dir, "docs", "p6", "index.html"), "utf8"));
    assert.equal(site.headers.link, `<${docs.url}>; rel="compression-dictionary"`);
    // The docs dictionary does not cover /about/: zstd + Link to the site one.
    const about = await get(url + "/about/", { "accept-encoding": CHROME_DICT, "available-dictionary": docs.available });
    assert.equal(about.headers["content-encoding"], undefined, "small page: identity");
    assert.equal(about.headers.link, `<${root.url}>; rel="compression-dictionary"`);
    // Unknown dictionary, or no `dcz` in Accept-Encoding: the usual zstd.
    assert.equal(
      (await get(url + "/docs/p5/", { "accept-encoding": CHROME_DICT, "available-dictionary": sf(Buffer.from("other")) })).headers["content-encoding"],
      "zstd",
    );
    assert.equal((await get(url + "/docs/p5/", { "accept-encoding": CHROME, "available-dictionary": docs.available })).headers["content-encoding"], "zstd");
    // Immutable assets keep their precompressed copies: no dictionary (a document dictionary does not help code).
    const asset = await get(url + "/assets/app-1a2b.js", { "accept-encoding": CHROME_DICT, "available-dictionary": root.available });
    assert.equal(asset.headers["content-encoding"], "zstd");
    assert.equal(asset.headers.vary, "Accept-Encoding");
    assert.equal(asset.headers.link, undefined);
  });
});

test("rendered pages (complete and streamed), endpoints and stored pages: dcz with the dictionary; dictionary: false and compress: false opt out", async () => {
  const { renderDocument } = await import("../server/render.ts");
  const document = () => ({ start: '<!doctype html><html><head><title>t</title></head><body><header class="site">', end: "</body></html>" });
  const input = { head: undefined, nonce: undefined, url: new URL("http://x/"), status: 200, styles: [] };
  const row = "z".repeat(200) + "\n"; // text children (escaped): no markup
  let release!: (value: string) => void;
  const stored = new TextEncoder().encode(page("Stored", "<p>" + "stored page ".repeat(100) + "</p>"));
  const handler: Handler = Object.assign(
    (request: Request) => {
      const path = new URL(request.url).pathname;
      if (path === "/docs/api") return Response.json({ items: Array.from({ length: 50 }, (_, i) => ({ id: i, title: "lorem ipsum" })) });
      const factory =
        path === "/docs/pending"
          ? () => ["shell", new Promise<string>((done) => (release = done)), Array.from({ length: 50 }, () => row)]
          : () => Array.from({ length: 20 }, () => row);
      return renderDocument(factory as never, input, { document }, { status: 200, headers: new Headers({ "content-type": "text/html; charset=utf-8" }) });
    },
    {
      [Symbol.for("rivet.routeCache")]: (_method: string, _origin: string, pathname: string) =>
        pathname === "/docs/stored"
          ? {
              body: stored,
              headers: [["content-type", "text/html; charset=utf-8"]],
              etag: '"s1"',
              created: Date.now(),
              modifiedAt: Date.now(),
              charge() {},
            }
          : undefined,
    },
  );
  await withServer(handler, async (url, dir) => {
    const docs = readDictionaries(dir)!.entries[0]!;
    const ask = { "accept-encoding": CHROME_DICT, "available-dictionary": docs.available };
    const complete = await get(url + "/docs/page", ask);
    assert.equal(complete.headers["content-encoding"], "dcz");
    assert.equal(complete.headers["content-length"], String(complete.body.length), "one compression call");
    assert.equal(dcz(complete.body, docs.bytes), document().start + row.repeat(20) + document().end);
    const linked = await get(url + "/docs/page", { "accept-encoding": CHROME });
    assert.equal(linked.headers["content-encoding"], "zstd");
    assert.equal(linked.headers.link, `<${docs.url}>; rel="compression-dictionary"`);
    assert.equal(linked.headers.vary, "Accept-Encoding, Available-Dictionary");
    const pending = get(url + "/docs/pending", ask);
    await new Promise((done) => setTimeout(done, 50));
    release("late");
    const streamed = await pending;
    assert.equal(streamed.headers["content-encoding"], "dcz");
    assert.equal(streamed.headers["content-length"], undefined, "streamed");
    assert.equal(dcz(streamed.body, docs.bytes), document().start + "shelllate" + row.repeat(50) + document().end);
    const api = await get(url + "/docs/api", ask);
    assert.equal(api.headers["content-encoding"], "dcz");
    assert.equal(api.headers.link, undefined, "JSON: no Link");
    assert.equal(JSON.parse(dcz(api.body, docs.bytes)).items.length, 50);
    const hit = await get(url + "/docs/stored", ask);
    assert.equal(hit.headers["x-rivet-cache"], "HIT");
    assert.equal(hit.headers["content-encoding"], "dcz");
    assert.equal(hit.headers.vary, "Accept-Encoding, Available-Dictionary");
    assert.equal(dcz(hit.body, docs.bytes), new TextDecoder().decode(stored));
    const miss = await get(url + "/docs/stored", { "accept-encoding": CHROME });
    assert.equal(miss.headers["content-encoding"], "zstd");
    assert.equal(miss.headers.link, `<${docs.url}>; rel="compression-dictionary"`);
  });
  for (const extra of [{ dictionary: false as const }, { compress: false }]) {
    await withServer(
      handler,
      async (url, dir) => {
        const docs = readDictionaries(dir)!.entries[0]!;
        const reply = await get(url + "/docs/p5/", { "accept-encoding": CHROME_DICT, "available-dictionary": docs.available });
        assert.notEqual(reply.headers["content-encoding"], "dcz");
        assert.equal(reply.headers.link, undefined);
        assert.equal((await get(url + docs.url)).status, 200, "the file itself stays a plain static file");
        assert.equal((await get(url + docs.url)).headers["use-as-dictionary"], undefined);
      },
      extra,
    );
  }
});

test("server mode: { samples } renders each sample page and its data answer once at start into the site dictionary", async () => {
  const seen: string[] = [];
  const handler: Handler = (request, context) => {
    const url = new URL(request.url);
    seen.push(url.pathname + url.search + " " + context.nonce);
    if (url.searchParams.has("_rivet")) return Response.json({ data: [{ title: url.pathname, text: "shared data text ".repeat(80) }] });
    return new Response(page(url.pathname, `<p>${"body of " + url.pathname} ${"shared prose ".repeat(80)}</p>`), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  };
  const dir = await mkdtemp(join(tmpdir(), "rivet-dict-"));
  const serving = await serve({ handler, client: dir, port: 0, dictionary: { samples: ["/a", "/b?x=1"] } });
  try {
    assert.deepEqual(seen, ["/a rivet-dictionary", "/a?_rivet=data rivet-dictionary", "/b?x=1 rivet-dictionary", "/b?x=1&_rivet=data rivet-dictionary"]);
    const first = await get(serving.url + "/c", { "accept-encoding": CHROME });
    const link = /^<(\/_rivet\/dict\/[\da-f]{16}\.dict)>; rel="compression-dictionary"$/.exec(String(first.headers.link));
    assert.ok(link, String(first.headers.link));
    const file = await get(serving.url + link[1]!);
    assert.equal(file.headers["use-as-dictionary"], `match="/*", id="${link[1]!.slice(13, 29)}"`);
    const later = await get(serving.url + "/c", { "accept-encoding": CHROME_DICT, "available-dictionary": sf(file.body) });
    assert.equal(later.headers["content-encoding"], "dcz");
    assert.ok(dcz(later.body, file.body).includes("body of /c"));
    const data = await get(serving.url + "/c?_rivet=data", { "accept-encoding": CHROME_DICT, "available-dictionary": sf(file.body) });
    assert.equal(data.headers["content-encoding"], "dcz");
  } finally {
    await serving.close();
    await rm(dir, { recursive: true, force: true });
  }
});
