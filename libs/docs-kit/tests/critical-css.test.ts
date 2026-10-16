// tools/critical-css.ts: selector needs, page presence, critical subset, inline / restore round trip.
import { strict as assert } from "node:assert";
import { test } from "vitest";
import {
  CLIENT_SELECTORS,
  criticalCSS,
  criticalSkip,
  DEFER_ACTIVATOR,
  inlineCritical,
  parseSheet,
  presence,
  pruneCustomProperties,
  restoreLinks,
  selectorNames,
  selectorNeeds,
} from "../tools/critical-css.ts";

test("selectorNeeds: classes (escaped), ids, tags, attribute names; pseudo arguments", () => {
  assert.deepEqual(selectorNeeds(".md\\:flex>a:hover"), [{ classes: ["md:flex"], ids: [], tags: ["a"], attrs: [] }]);
  assert.deepEqual(selectorNeeds("[data-theme=dark] .x::before"), [{ classes: ["x"], ids: [], tags: [], attrs: ["data-theme"] }]);
  assert.deepEqual(selectorNeeds(".w-\\[12px\\],#id[aria-x='a]b']"), [
    { classes: ["w-[12px]"], ids: [], tags: [], attrs: [] },
    { classes: [], ids: ["id"], tags: [], attrs: ["aria-x"] },
  ]);
  // :is() / :where() / :has(): one alternative each; :not() arguments are not needed.
  assert.deepEqual(selectorNeeds(":is(.a,.b) p:not(.q)"), [
    { classes: ["a"], ids: [], tags: ["p"], attrs: [] },
    { classes: ["b"], ids: [], tags: ["p"], attrs: [] },
  ]);
  assert.deepEqual(selectorNeeds(".tabs:has(input:checked) .pane"), [{ classes: ["tabs", "pane"], ids: [], tags: ["input"], attrs: [] }]);
  // Nothing named → always kept.
  assert.equal(selectorNeeds(":root"), null);
  assert.equal(selectorNeeds("*,:before,:after"), null);
  assert.equal(selectorNeeds(".x, ::backdrop"), null);
});

test("parse + emit with everything present = the sheet (comments / whitespace aside)", () => {
  const css =
    '/*! banner */@layer theme,base;@layer base{a{color:red}.b{content:"}{"}}@media (width>=40rem){.c{margin:0}}@font-face{font-family:X;src:url(x.woff2)}@keyframes k{0%{opacity:0}to{opacity:1}}.d{background:url("data:image/svg+xml,a{b}")}';
  const all = { classes: new Set<string>(), ids: new Set<string>(), tags: new Set<string>(), attrs: new Set<string>(), added: /./ };
  const page = { ...all, tags: new Set(["a"]) };
  assert.equal(criticalCSS([parseSheet(css)], page), css.replace("/*! banner */", ""));
});

test("criticalCSS keeps used rules in order, drops empty blocks, keeps statements / font faces / keyframes", () => {
  const css = "@layer a,b;.used{x:1}.unused{x:2}@media print{.unused{x:3}}@media screen{.used .also{x:4}}@font-face{font-family:F}@keyframes k{to{x:1}}";
  const page = presence('<!doctype html><html lang="en"><head></head><body><p class="used"><b class="also"></b></p></body></html>');
  assert.equal(criticalCSS([parseSheet(css)], page), "@layer a,b;.used{x:1}@media screen{.used .also{x:4}}@font-face{font-family:F}@keyframes k{to{x:1}}");
});

test("layer order survives: `@layer a,b;` statements always kept, named layer blocks kept empty", () => {
  const page = presence('<body><p class="used"></p></body>');
  // Nothing on the page matches: the statements and the named blocks (first appearance = layer order) stay.
  const css =
    "@layer theme,base;@layer late{.unused{x:1}}@layer base{.unused{x:2}}@layer{.unused{x:3}}@media print{@layer x{.unused{x:4}}}@layer base{.used{x:5}}";
  assert.equal(criticalCSS([parseSheet(css)], page), "@layer theme,base;@layer late{}@layer base{}@media print{@layer x{}}@layer base{.used{x:5}}");
});

test("presence: [data-css-defer] subtrees are skipped (the element itself counts), raw text is not markup", () => {
  const page = presence(
    '<body><section data-css-defer class="sec"><div class="inner"><section class="nested"></section></div></section><p class="after"></p>' +
      '<script>"<div class=\\"fake\\">"</script><code>&lt;i class="nope"&gt;</code></body>',
  );
  assert.ok(page.classes.has("sec") && page.classes.has("after"));
  assert.ok(!page.classes.has("inner") && !page.classes.has("nested") && !page.classes.has("fake") && !page.classes.has("nope"));
  assert.ok(page.attrs.has("data-theme"), "attributes set by the shell script count as present");
});

test("pruneCustomProperties: unreferenced custom properties and @property of nameless rules go, references kept to a fixpoint", () => {
  const css =
    '@layer properties,base;@property --tw-used{syntax:"*";inherits:false}@property --tw-unused{syntax:"*";inherits:false}' +
    "@layer properties{@supports (x:y){*,:before,:after{--tw-used:0;--tw-unused:0;--tw-chain:1}}}" +
    ":root{--a:var(--b);--b:2px;--c:3px;--orphan:var(--d);--d:4px;--html:1;color:var(--c)}" +
    ".x{margin:var(--a);box-shadow:var(--tw-used)}.y{--set-only:1}@keyframes k{to{width:var(--tw-chain)}}";
  assert.equal(
    pruneCustomProperties(css, '<p style="width:var(--html)"></p>'),
    '@layer properties,base;@property --tw-used{syntax:"*";inherits:false}' +
      "@layer properties{@supports (x:y){*,:before,:after{--tw-used:0;--tw-chain:1}}}" +
      ":root{--a:var(--b);--b:2px;--c:3px;--html:1;color:var(--c)}" +
      ".x{margin:var(--a);box-shadow:var(--tw-used)}.y{--set-only:1}@keyframes k{to{width:var(--tw-chain)}}",
  );
  // Nothing referenced: the nameless rule and its @supports go, the named layer block stays (layer order).
  assert.equal(pruneCustomProperties("@layer p{@supports (x:y){*{--z:0}}}.a{color:red}"), "@layer p{}.a{color:red}");
});

test("pruneCustomProperties: an identical fallback of another sheet / layer goes only when every declaration of it agrees", () => {
  const fallback = (layer: string, value = "0") => `@layer ${layer}{@supports (x:y){*,:before{--tw-s:${value};--tw-t:1}}}`;
  const use = ".x{box-shadow:var(--tw-s) var(--tw-t)}";
  assert.equal(pruneCustomProperties(fallback("properties") + use + fallback("ui.properties")), fallback("properties") + use + "@layer ui.properties{}");
  // --tw-s also set to 0 elsewhere → still one text, dropped; set to 2 by a named rule → every copy stays.
  assert.equal(
    pruneCustomProperties(fallback("properties") + ".y{--tw-s:2}" + use + fallback("ui.properties")),
    fallback("properties") + ".y{--tw-s:2}" + use + "@layer ui.properties{@supports (x:y){*,:before{--tw-s:0}}}",
  );
  // Different condition chain (not the same @supports): kept.
  assert.equal(pruneCustomProperties("*{--tw-t:1}" + use + "@media print{*{--tw-t:1}}"), "*{--tw-t:1}" + use + "@media print{*{--tw-t:1}}");
});

const SHELL = `<script>for(var l of document.querySelectorAll('${DEFER_ACTIVATOR}'))l.rel="stylesheet"</script>`;

test("inlineCritical: one inline style + deferred links + noscript; restoreLinks undoes it", async () => {
  const html =
    '<!doctype html><html lang="en"><head><title>t</title><link rel="stylesheet" href="/assets/a.css"><link rel="stylesheet" href="/assets/b.css">' +
    SHELL +
    '</head><body><p class="x">hi</p></body></html>';
  const sheets: Record<string, string> = { "/assets/a.css": ".x{color:red}.y{color:blue}", "/assets/b.css": ".z{margin:0}p{margin:1px}" };
  const out = await inlineCritical(html, async (href) => parseSheet(sheets[href]!));
  assert.ok(out.startsWith('<!doctype html><html data-rivet-critical lang="en">'));
  assert.match(
    out,
    /<style data-rivet-critical>\.x\{color:red\}p\{margin:1px\}<\/style><link rel="x-rivet-defer" href="\/assets\/a.css"><link rel="x-rivet-defer" href="\/assets\/b.css">/,
  );
  assert.match(
    out,
    /<noscript data-rivet-css><link rel="stylesheet" href="\/assets\/a.css"><link rel="stylesheet" href="\/assets\/b.css"><\/noscript><\/head>/,
  );
  assert.equal(restoreLinks(out), html);
  assert.equal(restoreLinks(html), html);
  // Highlighter classes added later count when asked.
  const coded = html.replace('<p class="x">hi</p>', '<pre data-lang="ts"></pre>');
  const withAdded = await inlineCritical(coded, async (href) => parseSheet(sheets[href] + ".hl-d73a49{color:#cf222e}"), /^hl-/);
  assert.match(withAdded, /\.hl-d73a49\{color:#cf222e\}/);
  // No head stylesheets → unchanged.
  const bare = '<!doctype html><html lang="en"><head></head><body></body></html>';
  assert.equal(await inlineCritical(bare, async () => parseSheet("")), bare);
});

test("guards: no activation script → links kept; attribute order free; links with other attributes stay blocking", async () => {
  const sheet = async () => parseSheet(".x{color:red}.y{color:blue}");
  const body = '<body><p class="x"></p></body></html>';
  const noScript = '<!doctype html><html lang="en"><head><link rel="stylesheet" href="/assets/a.css"></head>' + body;
  assert.equal(criticalSkip(noScript), 'no activation script (link[rel="x-rivet-defer"])');
  assert.equal(await inlineCritical(noScript, sheet), noScript);
  const odd =
    '<!doctype html><html lang="en"><head><link rel="stylesheet" media="print" href="/assets/p.css"><link href="/assets/a.css" rel="stylesheet">' +
    SHELL +
    "</head>" +
    body;
  assert.equal(criticalSkip(odd), undefined);
  const out = await inlineCritical(odd, sheet);
  assert.match(
    out,
    /<link rel="stylesheet" media="print" href="\/assets\/p.css"><style data-rivet-critical>\.x\{color:red\}<\/style><link rel="x-rivet-defer" href="\/assets\/a.css">/,
  );
  const onlyMedia = '<!doctype html><html lang="en"><head><link rel="stylesheet" media="print" href="/assets/p.css">' + SHELL + "</head>" + body;
  assert.equal(criticalSkip(onlyMedia), "no plain head stylesheet link");
  assert.equal(await inlineCritical(onlyMedia, sheet), onlyMedia);
});

test("client-added DOM: CLIENT_SELECTORS (shell menu, overlay layer, Transition) + a site's extra selectors count as present", async () => {
  const html = '<!doctype html><html lang="en"><head><link rel="stylesheet" href="/assets/a.css">' + SHELL + '</head><body><p class="x"></p></body></html>';
  const css = ".menu-item[data-focus-visible]{outline:1px}.cdk-overlay-pane{position:absolute}[data-entering]{opacity:0}.site-pop .site-item{x:1}.other{x:2}";
  const sheet = async () => parseSheet(css);
  const defaults = await inlineCritical(html, sheet);
  assert.match(
    defaults,
    /<style data-rivet-critical>\.menu-item\[data-focus-visible\]\{outline:1px\}\.cdk-overlay-pane\{position:absolute\}\[data-entering\]\{opacity:0\}<\/style>/,
  );
  const site = await inlineCritical(html, sheet, undefined, selectorNames([...CLIENT_SELECTORS, ".site-pop .site-item"]));
  assert.match(site, /\[data-entering\]\{opacity:0\}\.site-pop \.site-item\{x:1\}<\/style>/);
  assert.doesNotMatch(site, /\.other\{/);
});
