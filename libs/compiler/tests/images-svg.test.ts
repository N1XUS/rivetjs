// SVG in the image pipeline: svgo-optimised assets (dims, ids kept, sanitised) and the inline `?svg`
// component (sanitised, currentColor, prefixIds, props on the root) compiled for every target.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compile } from "../index.ts";
import { createPipeline } from "../images/pipeline.ts";
import { parseImageId, validateConfig } from "../images/options.ts";
import { inlineSvg, optimizeSvg, svgDimensions, svgoPlugins } from "../images/svg.ts";
import type { ImageProcessor } from "../images/processor.ts";
import { renderToString, type ServerValue } from "../../runtime/server.ts";

const LOGO = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: Illustrator -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="120px" height="40" viewBox="0 0 120 40" onload="alert(1)">
  <style>.cls-1{fill:#ff0000}.cls-2{stroke:#00ff00;stroke-width:2}</style>
  <script>alert(2)</script>
  <defs><linearGradient id="grad"><stop offset="0" stop-color="#123456"/></linearGradient><symbol id="dot"><circle cx="1" cy="1" r="1"/></symbol></defs>
  <a xlink:href="javascript:alert(3)"><rect class="cls-1" x="0" y="0" width="10.000001" height="10" onclick="alert(4)"/></a>
  <path class="cls-2" d="M 10 10 L 20 20 L 30 30" fill="url(#grad)" style="opacity:0.5"/>
  <use href="#dot" x="5"/>
  <text x="1" y="30">Hi {there} &amp; &lt;you&gt;</text>
</svg>
`;
/** Never called for SVG: the SVG path needs no sharp. */
const noSharp: ImageProcessor = {
  id: "none",
  metadata: () => Promise.reject(new Error("sharp used for svg")),
  encode: () => Promise.reject(new Error("sharp used for svg")),
  placeholder: () => Promise.reject(new Error("sharp used for svg")),
};

test("dimensions: width/height (px or unitless), one side + viewBox, viewBox only, none", () => {
  assert.deepEqual(svgDimensions('<svg width="120px" height="40" viewBox="0 0 1 1">'), { width: 120, height: 40 });
  assert.deepEqual(svgDimensions('<svg width="60" viewBox="0 0 120 40">'), { width: 60, height: 20 });
  assert.deepEqual(svgDimensions("<svg viewBox='0 0 24 12'>"), { width: 24, height: 12 });
  assert.deepEqual(svgDimensions('<svg width="10em" height="100%" viewBox="0,0,30,10">'), { width: 30, height: 10 });
  assert.equal(svgDimensions('<svg width="1em">'), null);
});

test("asset optimisation: smaller, viewBox and ids kept (external <use> refs), scripts / handlers / script URLs removed", async () => {
  const { data, warnings } = await optimizeSvg("logo.svg", LOGO, {});
  assert.ok(data.length < LOGO.length * 0.85, `${data.length} vs ${LOGO.length}`);
  assert.match(data, /viewBox="0 0 120 40"/);
  assert.match(data, /id="grad"/);
  assert.match(data, /id="dot"/);
  assert.doesNotMatch(data, /<script|onload|onclick|javascript:|<!--|<\?xml/);
  assert.match(data, /M0 0h10v10H0z/); // rect → path, precision 3
  assert.equal(warnings.length, 4);
  // svgo: false → sanitised only, otherwise untouched.
  const raw = await optimizeSvg("logo.svg", LOGO, false);
  assert.match(raw.data, /width="10.000001"/);
  assert.doesNotMatch(raw.data, /<script|onload/);
  // Custom plugin list replaces the default one.
  const custom = await optimizeSvg("logo.svg", '<svg width="2" height="2"><g><path d="M0 0"/></g></svg>', { plugins: ["collapseGroups"] });
  assert.equal(custom.data, '<svg width="2" height="2"><path d="M0 0"/></svg>');
  assert.equal(svgoPlugins("file").length, 1);
});

test("inline: sanitised static template; styles inlined into attributes; ids prefixed; props on the root", async () => {
  const { tsx, warnings } = await inlineSvg("/x/logo.svg", LOGO, {}, {});
  assert.ok(warnings.some((w) => /<script> removed/.test(w)));
  assert.ok(warnings.some((w) => /onload removed/.test(w)));
  assert.ok(warnings.some((w) => /unsafe xlink:href URL removed/.test(w)));
  assert.doesNotMatch(tsx, /script|onload|onclick|javascript:|<style|xmlns|class="cls/);
  assert.match(tsx, /<path fill="red" d="M0 0h10v10H0z" \/>/);
  assert.match(tsx, /id="logo-[0-9a-f]{5}_grad"/);
  assert.match(tsx, /fill="url\(#logo-[0-9a-f]{5}_grad\)"/);
  assert.match(tsx, /Hi &#123;there&#125; &amp; &lt;you&gt;/);
  const server = compile(tsx, { target: "server", filename: "logo.svg.tsx" });
  assert.deepEqual(server.diagnostics, []);
  // The SVG body is one static fragment (no per-attribute slots).
  assert.doesNotMatch(server.code, /__rivetAttribute\(/);
  const mod = (await import(
    "data:text/javascript;base64," +
      Buffer.from(server.code.replaceAll('"@rivetjs/runtime/server"', JSON.stringify(import.meta.resolve("../../runtime/server.ts")))).toString("base64")
  )) as {
    default: (props?: Record<string, unknown>) => ServerValue;
  };
  const plain = await renderToString(() => mod.default({}));
  assert.match(plain, /^<svg viewBox="0 0 120 40" width="120" height="40" aria-hidden="true"><defs>/);
  const styled = await renderToString(() => mod.default({ class: "brand", size: 32, style: { color: "red" }, "aria-label": "Brand" }));
  assert.match(styled, /^<svg viewBox="0 0 120 40" class="brand" style="color:red" aria-label="Brand" width="32" height="32" role="img">/);
  const titled = await renderToString(() => mod.default({ title: "Logo" }));
  assert.match(titled, /role="img"><title>Logo<\/title><defs>/);
  // DOM: the body is template text; the root's one `_spread` is the only attribute binding.
  const dom = compile(tsx, { target: "dom", filename: "logo.svg.tsx" });
  assert.deepEqual(dom.diagnostics, []);
  assert.match(dom.code, /_tpl\("<svg><!><defs>/);
  assert.equal([...dom.code.matchAll(/__rivet_spread\(/g)].length, 1);
  assert.match(dom.code, /__rivet_spread\(_el\$1, /);
  assert.doesNotMatch(dom.code, /_setAttr|_attrValue|_fx\(/);
});

test("inline directives: currentColor, prefixIds=false / custom prefix; data: images refuse to inline", async () => {
  const cc = await inlineSvg(
    "i.svg",
    '<svg viewBox="0 0 2 2"><path fill="#000" stroke="red" d="M0 0h1v1H0z"/><path fill="none" stroke="blue" d="M1 1h1v1H1z"/><path fill="url(#a)" d="M0 1h1v1H0z"/></svg>',
    {},
    { currentColor: true },
  );
  assert.match(cc.tsx, /<svg viewBox="0 0 2 2" fill="currentColor"/);
  assert.match(cc.tsx, /stroke="currentColor"/);
  assert.match(cc.tsx, /fill="none"/);
  assert.match(cc.tsx, /fill="url\(#i-[0-9a-f]{5}_a\)"/);
  assert.doesNotMatch(cc.tsx, /#000|red/);
  const ids = '<svg viewBox="0 0 2 2"><defs><path id="p" d="M0 0h1v1H0z"/></defs><use href="#p"/></svg>';
  assert.match((await inlineSvg("i.svg", ids, {}, { prefixIds: false })).tsx, /id="p"[^]*href="#p"/);
  assert.match((await inlineSvg("i.svg", ids, {}, { prefixIds: "brand" })).tsx, /id="brand_p"[^]*href="#brand_p"/);
  assert.match((await inlineSvg("i.svg", ids, { prefixIds: false }, {})).tsx, /id="p"/);
  await assert.rejects(inlineSvg("i.svg", '<svg><image href="data:image/png;base64,AAAA"/></svg>', {}, {}), /embedded data: image .* \?image/);
  const unsafe = await inlineSvg("i.svg", '<svg><a href=" java\tscript:x()"><text>a</text></a><set to="vbscript:x"/></svg>', {}, {});
  assert.doesNotMatch(unsafe.tsx, /script:/);
});

test("query parsing: ?svg keyword, directives, only .svg; one keyword per import; svgo config validated", () => {
  assert.deepEqual(parseImageId("/a/logo.svg?svg"), { file: "/a/logo.svg", kind: "svg", directives: {} });
  assert.deepEqual(parseImageId("/a/logo.svg?currentColor&prefixIds=false&svg&import"), {
    file: "/a/logo.svg",
    kind: "svg",
    directives: { currentColor: true, prefixIds: false },
  });
  assert.deepEqual(parseImageId("/a/logo.svg?prefixIds=x&svg")?.directives, { prefixIds: "x" });
  assert.throws(() => parseImageId("/a/photo.jpg?svg"), /\?svg needs an \.svg file/);
  assert.throws(() => parseImageId("/a/logo.svg?width=2&svg"), /unknown svg directive "width"/);
  assert.throws(() => parseImageId("/a/logo.svg?svg&jsx"), /use one of \?image, \?jsx or \?svg/);
  assert.equal(parseImageId("/a/logo.svg?url"), null);
  assert.throws(() => validateConfig({ svgo: "yes" as never }), /svgo must be false or/);
  validateConfig({ svgo: false });
  validateConfig({ svgo: { multipass: false, plugins: ["preset-default"], prefixIds: "x" } });
});

test("pipeline: SVG ?image descriptor from intrinsic size (no sharp), hashed optimised asset, cached; ?svg TSX cached", async () => {
  await mkdir(".artifacts", { recursive: true });
  const dir = await mkdtemp(resolve(".artifacts/images-svg-"));
  try {
    await writeFile(resolve(dir, "logo.svg"), LOGO);
    const ctx = { config: {}, processor: noSharp, base: "/", assetsDir: "assets", dev: false, cacheDir: resolve(dir, "cache") };
    const pipeline = createPipeline(ctx);
    const { descriptor, assets, warnings } = await pipeline.describe(resolve(dir, "logo.svg"), {});
    assert.equal(warnings.length, 4);
    assert.match(descriptor.src, /^\/assets\/logo-120-[0-9a-f]{8}\.svg$/);
    assert.deepEqual([descriptor.width, descriptor.height], [120, 40]);
    const bytes = (await pipeline.encode(assets[0]!)).toString("utf8");
    assert.doesNotMatch(bytes, /<script/);
    assert.ok(bytes.length < LOGO.length);
    const scaled = await pipeline.describe(resolve(dir, "logo.svg"), { width: 60 });
    assert.deepEqual([scaled.descriptor.width, scaled.descriptor.height], [60, 20]);
    // Second describe: cache hit, no re-optimisation warnings.
    assert.deepEqual((await pipeline.describe(resolve(dir, "logo.svg"), {})).warnings, []);
    // Different svgo setup → different key / file name.
    const off = await createPipeline({ ...ctx, config: { svgo: false } }).describe(resolve(dir, "logo.svg"), {});
    assert.notEqual(off.descriptor.src, descriptor.src);
    const first = await pipeline.inline(resolve(dir, "logo.svg"), {});
    const again = await pipeline.inline(resolve(dir, "logo.svg"), {});
    assert.equal(again.tsx, first.tsx);
    assert.deepEqual(again.warnings, []);
    assert.ok((await readdir(resolve(dir, "cache"))).some((name) => name.endsWith(".svg.tsx")));
    await writeFile(resolve(dir, "blank.svg"), "<svg/>");
    const blank = await pipeline.describe(resolve(dir, "blank.svg"), {});
    assert.deepEqual([blank.descriptor.width, blank.descriptor.height], [300, 150]);
    assert.match(blank.warnings[0]!, /no width \/ height \/ viewBox/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
