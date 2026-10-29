// Route CSS of a client bundle (`build/route-css.ts`) and the global stylesheets of a Vite manifest
// (`adapters/assemble.ts`): app entries' CSS is global, the CSS of a compiler entry (a derived boundary module, a route
// page among them: also Rollup entries) stays on the routes that import it (per-component CSS, @rivetjs/ui).
import { test } from "vitest";
import assert from "node:assert/strict";
import type { Rollup } from "vite";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BROTLI_SIZES, brotliLength, brotliSizes, bundleRouteCSS, dedupeTopLevel, inlineCSS, mergeRouteCSS } from "../build/route-css.ts";
import { assemble } from "../adapters/assemble.ts";
import type { GeneratedEntry } from "../server/app.ts";
import { headTags } from "../shared/head.ts";
import { cspPolicy } from "../shared/csp-directives.ts";
import { hashCSP } from "../adapters/static.ts";
import { strictCSP } from "../server/strict-csp.ts";
import { inlineStylesFor } from "../server/inline-styles.ts";
import type { RouteTable } from "../build/routes.ts";

const chunk = (fileName: string, options: { entry?: string; modules?: string[]; imports?: string[]; css?: string[] }): Rollup.OutputChunk =>
  ({
    type: "chunk",
    fileName,
    isEntry: !!options.entry,
    facadeModuleId: options.entry ?? null,
    moduleIds: options.modules ?? [],
    imports: options.imports ?? [],
    viteMetadata: { importedCss: new Set(options.css ?? []), importedAssets: new Set() },
  }) as unknown as Rollup.OutputChunk;

test("route CSS: a boundary module entry's stylesheet (a route page's too) is linked per route, not globally", () => {
  const bundle = {
    "styles.js": chunk("styles.js", { entry: "/app/src/styles.css", css: ["assets/styles.css"] }),
    "menu.js": chunk("menu.js", { entry: "/ui/menu.tsx", css: ["assets/menu.css"] }),
    "index.js": chunk("index.js", {
      entry: "/app/src/routes/index.tsx",
      modules: ["/app/src/routes/index.tsx"],
      imports: ["menu.js"],
      css: ["assets/index.css"],
    }),
    "about.js": chunk("about.js", { modules: ["/app/src/routes/about.tsx"] }),
  } as unknown as Rollup.OutputBundle;
  const table = {
    routes: [
      { id: "/", page: "index.tsx", layouts: [] },
      { id: "/about", page: "about.tsx", layouts: [] },
    ],
  } as unknown as RouteTable;
  assert.deepEqual(bundleRouteCSS(bundle, table, "/app/src/routes", "/", new Set(["/app/src/styles.css"])), { "/": ["/assets/menu.css", "/assets/index.css"] });
});

test("global stylesheets: app entries' CSS only, not the CSS of a boundary module entry (route page) in the resume manifest", () => {
  let styles: readonly string[] | undefined;
  const entry = { createApp: (config: { styles?: readonly string[] }) => ((styles = config.styles), {}) } as unknown as GeneratedEntry;
  const vite = {
    "src/styles.css": { file: "assets/styles.css", src: "src/styles.css", isEntry: true },
    "src/routes/index.tsx": { file: "assets/routes.js", src: "src/routes/index.tsx", isEntry: true, css: ["assets/routes.css"] },
    "rivet-derived-entry": { file: "assets/derived-runtime.js", src: "rivet-derived-entry", isEntry: true },
  };
  const manifest = { runtime: "/assets/derived-runtime.js", symbols: { "src/routes/index.tsx#default": "/assets/routes.js" } };
  assemble(entry, { clients: [{ base: "/", manifest, vite }] });
  assert.deepEqual(styles, ["/assets/styles.css"]);
});

const asset = (fileName: string, source: string) => ({ type: "asset", fileName, source }) as unknown as Rollup.OutputAsset;

test("route CSS: a route's stylesheets merge into one route sheet (Vite chunk markers dropped), shared by routes with the same list", () => {
  const bundle = {
    "assets/button.css": asset("assets/button.css", ".button{color:red}\n"),
    "assets/chip.css": asset("assets/chip.css", ".chip{color:blue}\n/*$vite$:1*/\n"),
    "assets/about.css": asset("assets/about.css", ".about{}\n"),
  } as unknown as Rollup.OutputBundle;
  const { routes, assets } = mergeRouteCSS(
    bundle,
    { "/": ["/assets/button.css", "/assets/chip.css"], "/en": ["/assets/button.css", "/assets/chip.css"], "/about": ["/assets/about.css"] },
    "/",
  );
  assert.equal(assets.length, 1);
  assert.match(assets[0]!.fileName, /^assets\/route-[\w-]{8}\.css$/);
  assert.equal(assets[0]!.source, ".button{color:red}\n.chip{color:blue}\n");
  assert.deepEqual(routes, { "/": ["/" + assets[0]!.fileName], "/en": ["/" + assets[0]!.fileName], "/about": ["/assets/about.css"] });
});

test("route CSS: a merged sheet keeps one copy of repeated top-level @property / @keyframes / @layer statements", () => {
  const a = '@layer properties,theme;@layer components{.a{color:red}}@property --x{syntax:"*";inherits:false}@keyframes k{0%{opacity:0}to{opacity:1}}';
  const b =
    '@layer properties,theme;@layer components{.b{content:"@property --x{}"}}@property --x{syntax:"*";inherits:false}@keyframes k{0%{opacity:0}to{opacity:1}}@keyframes k2{to{opacity:1}}';
  assert.equal(
    dedupeTopLevel(a + "\n" + b),
    '@layer properties,theme;@layer components{.a{color:red}}@property --x{syntax:"*";inherits:false}@keyframes k{0%{opacity:0}to{opacity:1}}\n@layer components{.b{content:"@property --x{}"}}@keyframes k2{to{opacity:1}}',
  );
});

// Incompressible CSS of about `bytes` bytes (distinct pseudo-random class names): brotli keeps most of it.
const noise = (bytes: number, seed = 1): string => {
  let out = "",
    x = seed;
  while (out.length < bytes) {
    x = (x * 1103515245 + 12345) % 2147483648;
    out += `.c${x.toString(36)}{color:#${(x % 4096).toString(16).padStart(3, "0")}}`;
  }
  return out;
};

test("inline stylesheets: the build lists sheets that may go inline (brotli + raw sizes); always / never / maxTotalBrotli", () => {
  const small = "a{color:red}";
  const big = noise(40_000);
  const bundle = {
    "assets/small.css": asset("assets/small.css", small + "\n/*$vite$:1*/"),
    "assets/big.css": asset("assets/big.css", big),
    "assets/font.css": asset("assets/font.css", "@font-face{src:url(./f.woff2)}"),
    "assets/abs.css": asset("assets/abs.css", '@font-face{src:url("/assets/f.woff2")}i{background:url(data:image/png;base64,x)}'),
    "entry.js": chunk("entry.js", { entry: "/app/entry.client.tsx" }),
  } as unknown as Rollup.OutputBundle;
  const merged = [{ fileName: "assets/route-x.css", source: "p{margin:0}\n" }];
  const auto = inlineCSS(bundle, merged, "/base/", "auto", 4096)!;
  assert.equal(auto.mode, "auto");
  assert.equal(auto.maxTotalBrotli, 6144);
  assert.equal(auto.limit, 4096);
  // big.css: brotli > 6 KB and raw > 4 KB, never inline under auto; font.css: relative reference.
  assert.deepEqual(Object.keys(auto.sheets), ["/base/assets/small.css", "/base/assets/abs.css", "/base/assets/route-x.css"]);
  assert.deepEqual(auto.sheets["/base/assets/small.css"], { css: small, bytes: small.length, br: auto.sheets["/base/assets/small.css"]!.br });
  assert.ok(auto.sheets["/base/assets/small.css"]!.br > 0);
  const always = inlineCSS(bundle, [], "/", "always", 4096)!;
  assert.equal(always.mode, "always");
  assert.deepEqual(Object.keys(always.sheets), ["/assets/small.css", "/assets/big.css", "/assets/abs.css"]);
  assert.ok(always.sheets["/assets/big.css"]!.br > 6144);
  assert.equal(inlineCSS(bundle, merged, "/", "never", 4096), undefined);
  // A higher total lists big.css too.
  assert.ok(inlineCSS(bundle, [], "/", { maxTotalBrotli: 1 << 20 }, 4096)!.sheets["/assets/big.css"]);
  assert.equal(inlineCSS({ "assets/f.css": asset("assets/f.css", "@import './x.css';") } as unknown as Rollup.OutputBundle, [], "/", "auto", 4096), undefined);
});

test("inline stylesheets: per page, all listed sheets when their brotli total fits, else the per-sheet raw limit", () => {
  const sheet = (bytes: number, br: number) => ({ css: "x".repeat(bytes), bytes, br });
  const manifest = {
    mode: "auto" as const,
    maxTotalBrotli: 6144,
    limit: 4096,
    sheets: { "/g.css": sheet(13_800, 3_500), "/r.css": sheet(227, 150), "/big.css": sheet(30_000, 5_000) },
  };
  const pick = inlineStylesFor(manifest);
  // Global 3.5 KB br + route 150 B br ≤ 6 KB: both inline (no render-blocking request).
  assert.deepEqual(Object.keys(pick(["/g.css", "/r.css"])!), ["/g.css", "/r.css"]);
  // + a 5 KB br sheet: 8.65 KB > 6 KB → only sheets ≤ 4 KB raw.
  assert.deepEqual(Object.keys(pick(["/g.css", "/r.css", "/big.css"])!), ["/r.css"]);
  // Unlisted sheets (too big, relative references) are linked and not counted.
  assert.deepEqual(Object.keys(pick(["/g.css", "/unlisted.css"])!), ["/g.css"]);
  assert.equal(pick(["/unlisted.css"]), undefined);
  // Cached per list.
  assert.equal(pick(["/g.css", "/r.css"]), pick(["/g.css", "/r.css"]));
  assert.deepEqual(Object.keys(inlineStylesFor({ ...manifest, mode: "always" })(["/g.css", "/r.css", "/big.css"])!), ["/g.css", "/r.css", "/big.css"]);
  assert.deepEqual(Object.keys(inlineStylesFor({ ...manifest, maxTotalBrotli: 0 })(["/g.css", "/r.css"])!), ["/r.css"]);
});

test("inline stylesheets: headTags writes them as nonce'd <style> in link order", () => {
  const html = headTags(undefined, { styles: ["/a.css", "/b.css", "/c.css"], inlineStyles: { "/b.css": "b{}</style><i>" }, nonce: "n1" });
  assert.equal(html, '<link rel="stylesheet" href="/a.css"><style data-href="/b.css" nonce="n1">b{}<\\/style><i></style><link rel="stylesheet" href="/c.css">');
  // Inherited keys never count.
  assert.equal(headTags(undefined, { styles: ["toString"], inlineStyles: {} }), '<link rel="stylesheet" href="toString">');
});

test("inline stylesheets: a style-src the app sets allows them (nonce / hash); none set, nothing added", () => {
  assert.doesNotMatch(strictCSP("N", { directives: { "img-src": "'self'" } }), /style-src/);
  assert.match(strictCSP("N", { directives: { "style-src": "'self'" } }), /style-src 'self' 'nonce-N'/);
  assert.match(strictCSP("N", { directives: { "style-src-elem": "'self'" } }), /style-src-elem 'self' 'nonce-N'/);
  // 'unsafe-inline' stays in effect (a nonce would turn it off).
  assert.match(strictCSP("N", { directives: { "style-src": "'self' 'unsafe-inline'" } }), /style-src 'self' 'unsafe-inline'(;|$)/);
  assert.equal(cspPolicy([["script-src", ["'self'"]]], undefined, false, ["'nonce-x'"]), "script-src 'self'");
  const page = '<html><head><meta charset="utf-8"><style>p{}</style></head><body><script>1</script></body></html>';
  const meta = /content="([^"]*)"/.exec(hashCSP(page, { directives: { "style-src": "'self'" } }))![1]!;
  assert.match(meta, /style-src 'self' 'sha256-[A-Za-z0-9+/=]+'/);
  assert.doesNotMatch(/content="([^"]*)"/.exec(hashCSP(page))![1]!, /style-src/);
});

test("inline stylesheets: rivetRouter validates the option", async () => {
  const { rivetRouter } = await import("../build/vite.ts");
  assert.throws(() => rivetRouter({ inlineStylesheets: "small" as never }), /inlineStylesheets must be "auto", "always", "never" or \{ maxTotalBrotli/);
  assert.throws(() => rivetRouter({ inlineStylesheets: { maxTotalBrotli: -1 } }), /inlineStylesheets must be/);
  assert.throws(() => rivetRouter({ inlineStylesheets: { max: 1 } as never }), /inlineStylesheets must be/);
  assert.ok(rivetRouter({ inlineStylesheets: { maxTotalBrotli: 8192 } }).length > 0);
  assert.ok(rivetRouter({ inlineStylesheets: "never" }).length > 0);
});

test("brotliSizes (INCR-BUILD): memoized sizes = fresh ones, persisted per brotli version, torn / foreign files ignored", () => {
  const dir = mkdtempSync(join(tmpdir(), "rivet-brotli-"));
  try {
    const sheets = [".a{color:red}".repeat(40), ".b{margin:0}@media (width>=40rem){.b{margin:1px}}", ""];
    const first = brotliSizes(dir);
    assert.deepEqual(sheets.map(first.size), sheets.map(brotliLength));
    assert.deepEqual([first.hits, first.misses], [0, 3]);
    first.save();
    const second = brotliSizes(dir);
    assert.deepEqual(sheets.map(second.size), sheets.map(brotliLength));
    assert.deepEqual([second.hits, second.misses], [3, 0]);
    // Another brotli build: the file is not trusted.
    const file = join(dir, BROTLI_SIZES);
    const data = JSON.parse(readFileSync(file, "utf8"));
    writeFileSync(file, JSON.stringify({ ...data, version: "other" }));
    assert.equal(brotliSizes(dir).size(sheets[0]!), brotliLength(sheets[0]!));
    writeFileSync(file, "{");
    const torn = brotliSizes(dir);
    torn.size(sheets[1]!);
    assert.equal(torn.misses, 1);
    // The manifest built through the memo equals the default one.
    const bundle = { "assets/a.css": { type: "asset", fileName: "assets/a.css", source: sheets[0] } } as unknown as Rollup.OutputBundle;
    assert.deepEqual(inlineCSS(bundle, [], "/", "auto", 4096, brotliSizes(dir).size), inlineCSS(bundle, [], "/", "auto", 4096));
    // No dir: in-memory only, save is a no-op.
    const memory = brotliSizes(undefined);
    memory.size(sheets[0]!);
    memory.size(sheets[0]!);
    memory.save();
    assert.deepEqual([memory.hits, memory.misses], [1, 1]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
