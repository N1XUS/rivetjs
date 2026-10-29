// tools/build-cache.ts (INCR-BUILD): per-page pass memo — store hit / miss / version scope / prune, cached tokens, and
// critical CSS from the cache = a fresh run (byte for byte), a changed stylesheet or page recomputed.
import { strict as assert } from "node:assert";
import { mkdir, mkdtemp, readdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, test } from "vitest";
import { buildCache, buildCacheRoot, digest } from "../tools/build-cache.ts";
import { DEFER_ACTIVATOR, inlineCriticalPages } from "../tools/critical-css.ts";
import { cachedTokenize, pageTokenizer } from "../tools/highlight-pages.ts";

const dirs: string[] = [];
const savedRoot = process.env.RIVET_CACHE_DIR;
beforeAll(async () => {
  process.env.RIVET_CACHE_DIR = await temp();
});
afterAll(async () => {
  if (savedRoot === undefined) delete process.env.RIVET_CACHE_DIR;
  else process.env.RIVET_CACHE_DIR = savedRoot;
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});
async function temp(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "docs-kit-build-cache-"));
  dirs.push(dir);
  return dir;
}

test("store: miss, hit, version scope, prune by least recent use", async () => {
  const root = await temp();
  const a = buildCache(root, "stage", "v1");
  assert.equal(a.get("k"), undefined);
  a.set("k", "value é");
  assert.equal(a.get("k"), "value é");
  assert.deepEqual([a.hits, a.misses], [1, 1]);
  // Another version never reads it.
  assert.equal(buildCache(root, "stage", "v2").get("k"), undefined);
  assert.notEqual(digest("a", "b"), digest("ab"));
  assert.notEqual(digest(undefined), digest("undefined"));
  // Prune: 10 entries of ~1 KB (gzip of random text), cap 6 KB → oldest go until ≤ 80 %.
  const small = buildCache(root, "prune", "v", 6 / 1024);
  for (let i = 0; i < 10; i++) small.set(`e${i}`, Array.from({ length: 300 }, () => Math.random().toString(36).slice(2, 6)).join(""));
  // Stored outside the app (`rivetCacheDir()`), per app path.
  const base = join(buildCacheRoot(root), "prune");
  assert.ok(base.startsWith(process.env.RIVET_CACHE_DIR!));
  assert.deepEqual(await readdir(root), []);
  const files: string[] = [];
  for (const sub of await readdir(base)) for (const name of await readdir(join(base, sub))) files.push(join(base, sub, name));
  // Oldest = the first written (explicit mtimes: a fast host writes them in one tick).
  for (let i = 0; i < 10; i++) {
    const file = join(base, digest("v", `e${i}`).slice(0, 2), digest("v", `e${i}`).slice(2) + ".gz");
    const time = new Date(Date.UTC(2026, 0, 1, 0, 0, i));
    await utimes(file, time, time);
  }
  assert.equal(files.length, 10);
  assert.ok(small.prune() > 0);
  assert.equal(small.get("e0"), undefined);
  assert.ok(small.get("e9"));
});

test("cachedTokenize: tokens from the store equal fresh ones; unknown languages stay undefined", async () => {
  const root = await temp();
  const tokenize = await pageTokenizer();
  let calls = 0;
  const counted = (text: string, lang: string) => (calls++, tokenize(text, lang));
  const cache = buildCache(root, "highlight", "t");
  const code = "const a = 1;\nexport function f() {\n  return a;\n}";
  const fresh = tokenize(code, "ts");
  assert.deepEqual(cachedTokenize(counted, cache)(code, "ts"), fresh);
  assert.deepEqual(cachedTokenize(counted, cache)(code, "ts"), fresh);
  assert.equal(calls, 1);
  assert.equal(cachedTokenize(counted, cache)("x", "nope"), tokenize("x", "nope"));
  assert.equal(cachedTokenize(counted, cache)("x", "nope"), tokenize("x", "nope"));
  assert.equal(calls, 2);
});

const SHELL = `<script>for(var l of document.querySelectorAll('${DEFER_ACTIVATOR}'))l.rel="stylesheet"</script>`;
const page = (body: string) =>
  '<!doctype html><html lang="en"><head><title>t</title><link rel="stylesheet" href="/assets/a.css">' + SHELL + `</head><body>${body}</body></html>`;

async function site(root: string, sheet: string, pages: Record<string, string>): Promise<string> {
  const client = join(root, "client");
  await rm(client, { recursive: true, force: true });
  await mkdir(join(client, "assets"), { recursive: true });
  await writeFile(join(client, "assets/a.css"), sheet);
  for (const [file, html] of Object.entries(pages)) {
    await mkdir(join(client, file, ".."), { recursive: true });
    await writeFile(join(client, file), html);
  }
  return client;
}
const read = async (client: string, files: string[]) => Promise.all(files.map((file) => readFile(join(client, file), "utf8")));

test("inlineCriticalPages: cached = fresh byte for byte; a changed sheet or page is recomputed", async () => {
  const root = await temp();
  const pages = { "index.html": page('<p class="x">hi</p>'), "b/index.html": page('<p class="y">yo</p><p class="x">x</p>') };
  const files = Object.keys(pages);
  const sheet = ".x{color:red}.y{color:blue}.z{margin:0}";
  // Reference: no cache.
  let client = await site(root, sheet, pages);
  await inlineCriticalPages(client);
  const fresh = await read(client, files);
  assert.match(fresh[0]!, /<style data-rivet-critical>\.x\{color:red\}<\/style>/);
  // Miss (fills), then hit: same bytes.
  const cache = () => buildCache(root, "critical", "v");
  for (const expected of [0, 2]) {
    client = await site(root, sheet, pages);
    const { reused } = await inlineCriticalPages(client, { cache: cache() });
    assert.deepEqual(await read(client, files), fresh);
    assert.equal(reused, expected);
  }
  // The stylesheet changed (same href): entries are stale, recomputed = a fresh run over the new sheet.
  const sheet2 = ".x{color:green}.y{color:blue}";
  client = await site(root, sheet2, pages);
  await inlineCriticalPages(client);
  const fresh2 = await read(client, files);
  client = await site(root, sheet2, pages);
  assert.equal((await inlineCriticalPages(client, { cache: cache() })).reused, 0);
  assert.deepEqual(await read(client, files), fresh2);
  // One page changed: it alone is computed.
  const pages3 = { ...pages, "index.html": page('<p class="y">changed</p>') };
  client = await site(root, sheet2, pages3);
  await inlineCriticalPages(client);
  const fresh3 = await read(client, files);
  client = await site(root, sheet2, pages3);
  assert.equal((await inlineCriticalPages(client, { cache: cache() })).reused, 1);
  assert.deepEqual(await read(client, files), fresh3);
});
