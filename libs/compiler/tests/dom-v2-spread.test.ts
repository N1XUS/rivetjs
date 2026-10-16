import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

// DOM v2 lowering of `{...spread}`, `ref`, class / style groups (scratchpad spec dom-v2-spread.md):
// spread elements stay in the hoisted `_tpl` and get one `_spread` statement with the merged object.
const v2 = (source: string) => compile(source, { target: "dom", filename: "m.tsx" });
const header = `import { signal } from "@rivetjs/reactivity";\n`;

test("spread element: `_tpl` + one `_spread` with the merged object (thunk when any part can read state)", () => {
  const r = v2(
    header +
      `export const view = (attrs: any, id: () => string) => <div>
  <a class="a" {...attrs} href={id()} onClick={() => 1}>x</a>
  <span {...attrs} data-x="1" />
  <i {...attrs}>{id()}</i>
</div>;`,
  );
  assert.deepEqual(r.diagnostics, []);
  assert.doesNotMatch(r.code, /__rivetSpec|data-rivet-s|spreadAttributes/);
  assert.match(r.code, /import \{[^}]*_spread as __rivet_spread[^}]*\} from "@rivetjs\/runtime\/dom"/);
  // IMPL-SPREAD F1: attributes after the last spread lower on their own — static ones are template text.
  assert.ok(r.code.includes('__rivet_tpl("<div><a>x</a><span data-x=1></span><i> ")'), r.code);
  // Dynamic part (`id()`) after the spread: one `_attrs` binding after the spread, its name excluded from the spread;
  // the explicit `onClick` is delegated and emitted before the spread; `class` before the spread stays in the object.
  assert.match(
    r.code,
    /__rivet_on\(_el\$2, "click", \(\) => 1\);\n\s*__rivet_spread\(_el\$2, \(\) => \(\{\s*"class": "a",\s*\.\.\.attrs\s*\}\), 0, null, "href"\);\n\s*__rivet_attrs\(_el\$2, \(\) => \[id\(\)\], "href"\);/,
  );
  // A lone identifier spread with only static trailing attributes passes uncopied (flag 2) + content flag 1.
  assert.match(r.code, /__rivet_spread\(_el\$3, attrs, 3, null, "data-x"\);/);
  // JSX children: no content flag; the child binding is the element's own.
  // Closure-free text binding (OPT-D): hoisted writer on the placeholder Text (`_tx`), `id` passed as a capture.
  assert.match(r.code, /const __rivetFx0 = \((_el\$\d+), id\) => \{\n\s*try \{\n\s*__rivet_tx\(\1, id\(\)\);/);
  // A lone identifier spread passes uncopied (flag 2: read inside the spread effect).
  assert.match(r.code, /__rivet_spread\(_el\$4, attrs, 2\);\n\s*__rivet_fx1\(__rivetFx0, (_el\$\d+), id\);/);
  assert.match(r.code, /(_el\$\d+) = _el\$4\.firstChild/);
});

test("spread element: `class:` toggles wrap the object in `_spreadClass`; a dynamic toggle makes it a thunk", () => {
  const r = v2(header + `export const view = (attrs: any, on: () => boolean) => <p {...attrs} class:on={on()} class:x>t</p>;`);
  assert.deepEqual(r.diagnostics, []);
  assert.match(r.code, /__rivet_spread\(_el\$1, \(\) => __rivetSpreadClass\(\{ \.\.\.attrs \}, \{\s*"on": on\(\),\s*"x": true\s*\}\)\)/);
  assert.match(r.code, /import \{[^}]*_spreadClass as __rivetSpreadClass[^}]*\} from "@rivetjs\/runtime\/style"/);
});

test("spread element: the style group joins the object (MATRIX-1), `ref` is `_ref`; unsafe static names; `select` / `textarea` spreads", () => {
  const r = v2(header + `export const view = (attrs: any, c: () => string, r: any) => <p {...attrs} ref={r} style={{ color: c() }} style:width="1px">t</p>;`);
  assert.deepEqual(r.diagnostics, []);
  assert.match(
    r.code,
    /__rivet_ref\(_el\$1, r\);\n\s*__rivet_spread\(_el\$1, \(\) => \(\{\s*\.\.\.attrs,\s*"style": \{\s*"color": c\(\),\s*"width": "1px"\s*\},\s*"ref": void 0\s*\}\)\)/,
  );
  assert.doesNotMatch(r.code, /BindStyle/);
  const bad = v2(`export const view = (attrs: any) => <p {...attrs} innerHTML="x">t</p>;`);
  assert.deepEqual(
    bad.diagnostics.map((d) => d.message),
    ["Unsafe or unsupported native attribute: innerHTML"],
  );
  // Spread select / textarea: the spread runs before options exist.
  const controls = v2(`export const view = (attrs: any) => <div><select {...attrs}><option>1</option></select><textarea {...attrs} /></div>;`);
  assert.deepEqual(controls.diagnostics, []);
  assert.match(controls.code, /__rivet_spread\(_el\$\d+, attrs, 2\);\n\s*__rivet_spread\(_el\$\d+, attrs, 2\)/);
  assert.doesNotMatch(controls.code, /__rivetSpreadAttributes/);
});

test("ref, class groups and style groups on plain v2 elements", () => {
  const r = v2(
    header +
      `export const view = (c: () => string, on: () => boolean, r: any) => <div>
  <b ref={r} class="base" class:on={on()} class:x>y</b>
  <i class={c()} class:on={on()}>z</i>
  <u class={["a", { b: on() }]} style={{ color: c(), "--x": 1 }}>w</u>
  <s class={{ k: true }} style:color="red">v</s>
</div>;`,
  );
  assert.deepEqual(r.diagnostics, []);
  // Literal base + literal toggles stay in the template; dynamic toggles bind with `_bindClass`.
  assert.ok(r.code.includes('__rivet_tpl("<div><b class=\\"base x\\">y</b><i>z</i><u>w</u><s class=k>v")'), r.code);
  assert.match(r.code, /__rivet_ref\(_el\$2, r\);\n\s*__rivetBindClass\(_el\$2, "on", \(\) => on\(\)\);/);
  // Dynamic base: one `_cls` effect over the merged `_class` value (closure-free, OPT-D: hoisted writers).
  assert.match(r.code, /const __rivetFx0 = \(_el\$3, c, on\) => __rivet_cls\(_el\$3, __rivetClass\(c\(\), \{ "on": on\(\) \}\)\);/);
  assert.match(r.code, /const __rivetFx1 = \(_el\$4, on\) => __rivet_cls\(_el\$4, __rivetClass\(\["a", \{ b: on\(\) \}\]\)\);/);
  assert.match(
    r.code,
    /__rivet_fx1\(__rivetFx0, _el\$3, c, on\);\n\s*__rivet_fx1\(__rivetFx1, _el\$4, on\);\n\s*__rivetBindStyle\(_el\$4, "color", \(\) => c\(\)\);\n\s*__rivetBindStyle\(_el\$4, "--x", "1"\);/,
  );
  assert.match(r.code, /__rivetBindStyle\(_el\$5, "color", "red"\);/);
  assert.doesNotMatch(r.code, /__rivetSpec|__rivetTemplate\(/);
  // A style string is still the diagnostic (from the style group analysis).
  const bad = v2(`export const view = () => <p style="color: red">t</p>;`);
  assert.equal(bad.diagnostics.length, 1);
  assert.match(bad.diagnostics[0]!.message, /style strings are not supported/);
});

test("spread + ref: DOM `_ref` before `_spread`; an explicit ref after the spread masks the spread's `ref` key (both targets)", () => {
  const source = header + `export const view = (attrs: any, r: any) => <p {...attrs} ref={r}>t</p>;`;
  const dom = compile(source, { target: "dom", filename: "m.tsx" });
  const server = compile(source, { target: "server", filename: "m.tsx" });
  assert.deepEqual(dom.diagnostics, []);
  // ref-spread-dedupe (LIVE-PROPS P4): the explicit `ref` after the spread wins — the spread object ends with `ref: undefined`.
  assert.match(dom.code, /__rivet_ref\(_el\$1, r\);\n\s*__rivet_spread\(_el\$1, \(\) => \(\{\s*\.\.\.attrs,\s*"ref": void 0\s*\}\)\);/);
  assert.doesNotMatch(dom.code, /__rivetSpreadAttributes|__rivetBindRef/);
  assert.match(server.code, /__rivetSpreadAttributes\(\{\s*\.\.\.attrs,\s*"ref": void 0\s*\}, "p"\)/);
  assert.doesNotMatch(server.code, /__rivet_spread|__rivet_ref/);
});
