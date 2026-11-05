// Bun / Deno static index (`adapters/files.ts`) over a temp dir with synthetic Requests (no runtime needed; FIX2
// r3-testgaps#7) + the shared listen options (`server-target.ts`).
import { afterAll, beforeAll, test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acceptWeights, negotiate, staticFiles, weightOf } from "../adapters/files.ts";
import { listenOptions } from "../adapters/server-target.ts";

let dir = "";
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "rivet-files-"));
  await mkdir(join(dir, "assets"));
  await mkdir(join(dir, ".well-known"));
  await mkdir(join(dir, "docs", ".well-known"), { recursive: true });
  await mkdir(join(dir, "about"));
  await writeFile(join(dir, "assets", "a.js"), "export {}");
  await writeFile(join(dir, "assets", "a.js.br"), "br");
  await writeFile(join(dir, "assets", "a.js.gz"), "gz");
  await writeFile(join(dir, "assets", "a.js.zst"), "zst");
  await writeFile(join(dir, ".well-known", "security.txt"), "x");
  await writeFile(join(dir, "docs", ".well-known", "x.txt"), "nested");
  await writeFile(join(dir, ".env"), "SECRET=1");
  await writeFile(join(dir, "about", "index.html"), "<p>about</p>");
  await writeFile(join(dir, "reindex.html"), "<p>reindex</p>");
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const get = (url: string, headers: Record<string, string> = {}) => new Request("http://x" + url, { headers });

test("staticFiles: dot files skipped (root .well-known only), bad decodes / NUL miss, directory pages, base headers", () => {
  const lookup = staticFiles(dir, "", ["/assets/"], { "X-Content-Type-Options": "nosniff" });
  for (const url of ["/.env", "/docs/.well-known/x.txt", "/assets/a.js%00", "/%E0%A4%A", "/assets/../.env", "//assets/a.js"])
    assert.equal(lookup(get(url), url), null, url);
  assert.ok(lookup(get("/.well-known/security.txt"), "/.well-known/security.txt"));
  for (const url of ["/about", "/about/"]) assert.match(lookup(get(url), url)!.path!, /about[\\/]index\.html$/, url);
  // `reindex.html` is the page `/reindex`, not an index page of `/re`.
  assert.equal(lookup(get("/re"), "/re"), null);
  assert.match(lookup(get("/reindex"), "/reindex")!.path!, /reindex\.html$/);
  const plain = lookup(get("/about"), "/about")!;
  assert.equal(plain.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(plain.headers["Cache-Control"], "no-cache");
});

test("staticFiles: siblings by q (zstd > br > gzip on ties, q=0 excludes), ETag 304 with validators", () => {
  const lookup = staticFiles(dir, "", ["/assets/"]);
  const pick = (accept: string) => lookup(get("/assets/a.js", { "accept-encoding": accept }), "/assets/a.js")!;
  assert.equal(pick("gzip, br, zstd").headers["Content-Encoding"], "zstd");
  assert.equal(pick("gzip, br").headers["Content-Encoding"], "br");
  assert.equal(pick("br;q=0, gzip").headers["Content-Encoding"], "gzip");
  assert.equal(pick("identity").headers["Content-Encoding"], undefined);
  assert.equal(pick("br").headers["Cache-Control"], "public, max-age=31536000, immutable");
  assert.equal(pick("br").headers.Vary, "Accept-Encoding");
  const etag = pick("").headers.ETag!;
  const unchanged = lookup(get("/assets/a.js", { "if-none-match": etag }), "/assets/a.js")!;
  assert.equal(unchanged.path, null);
  assert.equal(unchanged.headers.ETag, etag);
  assert.equal(unchanged.headers.Vary, "Accept-Encoding");
  assert.equal(lookup(get("/assets/a.js", { "if-none-match": "*" }), "/assets/a.js")!.path, null);
  assert.ok(lookup(get("/assets/a.js", { "if-none-match": '"other"' }), "/assets/a.js")!.path);
});

// FIX2 (r3-edges#14): `[\d.]+` took `1.2.3` (NaN: never picked) and `1.5` (outranked q=1).
test("acceptWeights: RFC qvalues only; a malformed q excludes the coding", () => {
  const weights = acceptWeights("gzip;q=0.5, br;q=1.5, zstd;q=1.2.3, deflate;q=., x;q=1.000, *;q=0.1");
  assert.equal(weightOf(weights, "gzip"), 0.5);
  assert.equal(weightOf(weights, "br"), 0);
  assert.equal(weightOf(weights, "zstd"), 0);
  assert.equal(weightOf(weights, "deflate"), 0);
  assert.equal(weightOf(weights, "x"), 1);
  assert.equal(weightOf(weights, "other"), 0.1);
  assert.equal(negotiate("br;q=1.5, gzip;q=1"), "gzip");
});

// FIX2 (router#4): `PORT=""` was port 0 (random), `HOST=""` hostname "".
test("listenOptions: empty PORT / HOST are unset", () => {
  const saved = { PORT: process.env.PORT, HOST: process.env.HOST };
  try {
    process.env.PORT = "";
    process.env.HOST = "";
    assert.deepEqual(listenOptions({}), { port: 3000, hostname: "0.0.0.0" });
    process.env.PORT = "4501";
    process.env.HOST = "127.0.0.1";
    assert.deepEqual(listenOptions({}), { port: 4501, hostname: "127.0.0.1" });
    assert.deepEqual(listenOptions({ port: 1, hostname: "h" }), { port: 1, hostname: "h" });
  } finally {
    for (const [name, value] of Object.entries(saved)) value === undefined ? delete process.env[name] : (process.env[name] = value);
  }
});

// FIX2 (r3-errors#6): an unreadable / truncated optional manifest was "no route CSS" (pages without their styles).
test("readManifests: optional manifests absent → undefined; truncated → throws naming the file", async () => {
  const { readManifests } = await import("../adapters/build.ts");
  const dist = await mkdtemp(join(tmpdir(), "rivet-manifests-"));
  try {
    await mkdir(join(dist, "client", ".vite"), { recursive: true });
    await writeFile(join(dist, "client", ".vite", "rivet-resume.json"), "{}");
    await writeFile(join(dist, "client", ".vite", "manifest.json"), "{}");
    const plain = await readManifests(dist);
    assert.equal(plain.routeStyles, undefined);
    await writeFile(join(dist, "client", ".vite", "rivet-route-css.json"), '{"a": [');
    await assert.rejects(readManifests(dist), /rivet-route-css\.json is not valid JSON/);
  } finally {
    await rm(dist, { recursive: true, force: true });
  }
});

// FIX2 (router-compiler-2#34): `name in ENTRY_FILE` accepted prototype keys.
test("adapterOptions: prototype keys are unknown adapters", async () => {
  const { adapterOptions } = await import("../adapters/target-build.ts");
  for (const name of ["toString", "constructor", "__proto__"]) assert.throws(() => adapterOptions(name as never), /unknown adapter/, name);
  assert.deepEqual(adapterOptions("bun"), { name: "bun" });
});
