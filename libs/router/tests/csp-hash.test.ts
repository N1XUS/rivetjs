// Direct table tests of the regex-based tag parsing behind hash CSP policies.
import { test } from "vitest";
import assert from "node:assert/strict";
import { hashPolicy, inlineSources, noncedSources } from "../shared/csp-hash.ts";

test("inlineSources: which inline scripts a hash policy allows", () => {
  const cases: [html: string, scripts: string[], origins: string[]][] = [
    ["<script>a</script>", ["a"], []],
    ["<SCRIPT>a</SCRIPT >", ["a"], []],
    ["<script type=text/javascript>a</script>", ["a"], []],
    ["<script type='module'>a</script>", ["a"], []],
    ['<script type=" MODULE ">a</script>', ["a"], []],
    ['<script type="speculationrules">{}</script>', ["{}"], []],
    ['<script type="application/json">{}</script>', [], []],
    ['<script data-src="x">a</script>', ["a"], []],
    ['<script data-type="application/json">a</script>', ["a"], []],
    ['<script src="https://cdn.example/a.js"></script>', [], ["https://cdn.example"]],
    ['<script SRC="https://cdn.example/a.js?x=1&amp;y=2"></script>', [], ["https://cdn.example"]],
    ['<script src="/local.js"></script>', [], []],
    ['<script src="javascript:alert(1)"></script>', [], []],
    ["<script src='https://cdn.example/a.js'></script>", [], []],
    ["<script>a</script><script>a</script>", ["a", "a"], []],
    ["<script>never closed", [], []],
    ['<script id="rivet-scripts">{let l=not json</script>', ["{let l=not json"], []],
  ];
  for (const [html, scripts, origins] of cases) {
    const found = inlineSources(html, false);
    assert.deepEqual(found.scripts, scripts, html);
    assert.deepEqual([...found.origins], origins, html);
  }
  assert.deepEqual(inlineSources("<style>a{}</style><STYLE media=x>b{}</style >", true).styles, ["a{}", "b{}"]);
  assert.deepEqual(inlineSources("<style>a{}</style>", false).styles, []);
});

test("noncedSources: only the renderer's own tags enter the policy; a stray nonce refuses the page", () => {
  const N = "n0nce";
  const read = (text: string, styles = true) => noncedSources(text, N, styles, (start, end) => text.slice(start, end));
  const bodies = (text: string, ranges: [number, number][]) => ranges.map(([start, end]) => text.slice(start, end));
  // Not storable: the nonce outside a renderer-written ` nonce="…"` attribute.
  for (const text of [
    `<script>var leak="${N}"</script>`,
    `<a title="${N}">x</a>`,
    `<a href="/?${N}">x</a>`,
    `<script nonce='${N}'>a</script>`,
    `<script data-nonce="${N}">a</script>`,
    `<div nonce="${N}">a</div>`,
    `<script x=" nonce="${N}">a</script>`,
    `<script nonce="${N}">never closed`,
    ` nonce="${N}"`,
  ])
    assert.equal(read(text), null, text);
  assert.equal(
    noncedSources("<script>a</script>", "", true, () => ""),
    null,
    "no nonce at all",
  );
  // Injected markup without the nonce stays out; the renderer's script stays in.
  const page = `<script>injected()</script><script nonce="${N}">own()</script><style nonce="${N}">a{}</style><link nonce="${N}" rel="preload" href="/a"><style>b{}</style>`;
  const found = read(page)!;
  assert.deepEqual(bodies(page, found.scripts), ["own()"]);
  assert.deepEqual(bodies(page, found.styles), ["a{}"]);
  assert.equal(found.attrs.length, 3);
  assert.deepEqual(read(page, false)!.styles, []);
  // Non-executable and file scripts: nonce removed from the stored copy, but no hash; file origins kept.
  const data = `<script nonce="${N}" type="application/json">{}</script><script nonce="${N}" src="https://cdn.example/a.js"></script>`;
  const other = read(data)!;
  assert.deepEqual(other.scripts, []);
  assert.deepEqual([...other.origins], ["https://cdn.example"]);
  assert.equal(other.attrs.length, 2);
});

test("hashPolicy: dedupes sources; frame-ancestors only in a header policy", () => {
  const header = hashPolicy(["'sha256-a'", "'sha256-a'"], ["https://cdn.example"], [], undefined, false);
  assert.equal(header.match(/'sha256-a'/g)!.length, 1);
  assert.match(header, /script-src 'sha256-a' 'self' https:\/\/cdn\.example/);
  assert.match(header, /object-src 'none'/);
  assert.match(header, /base-uri 'none'/);
  assert.match(header, /frame-ancestors 'self'/);
  assert.doesNotMatch(hashPolicy([], [], [], undefined, true), /frame-ancestors/);
});
