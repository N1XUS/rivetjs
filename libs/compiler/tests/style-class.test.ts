// G10: class: / style: directives, class objects / arrays, style objects and safe style values.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const squash = (code: string) => code.replace(/\s+/g, " ");
const both = (source: string, options: Record<string, unknown> = {}) => {
  const dom = compile(source, { target: "dom", filename: "a.tsx", ...options });
  const server = compile(source, { target: "server", filename: "a.tsx", ...options });
  assert.deepEqual(dom.diagnostics, []);
  assert.deepEqual(server.diagnostics, []);
  return { dom: squash(dom.code), server: squash(server.code) };
};
const messages = (source: string, target: "server" | "dom" = "server") => compile(source, { target, filename: "a.tsx" }).diagnostics.map((d) => d.message);

test("static class: / style: values fold into the server markup; DOM sets styles through CSSOM", () => {
  const { dom, server } = both(
    `export const A = () => <div class="a b" class:c class:b={false} class:d={true} style:color="red" style={{ "--rv-x": 1, marginTop: "2px", opacity: null }} />;`,
  );
  assert.match(server, /"<div class=\\"a c d\\" style=\\"color:red;--rv-x:1;margin-top:2px\\"><\/div>"/);
  assert.doesNotMatch(server, /__rivetClass|__rivetStyle/);
  assert.match(dom, /__rivet_tpl\("<div class=\\"a c d\\">"\)/);
  assert.match(dom, /__rivetBindStyle\(_el\$1, "color", "red"\); __rivetBindStyle\(_el\$1, "--rv-x", "1"\); __rivetBindStyle\(_el\$1, "margin-top", "2px"\);/);
  assert.doesNotMatch(dom, /style=/);
});

test("dynamic class: toggles: server merges into the class attribute, DOM toggles with classList", () => {
  const { dom, server } = both(
    `export const A = (p: { on: boolean; big: () => boolean }) => <p id="x" class="a" class:on={p.on} class:is-big={p.big()}>t</p>;`,
  );
  assert.match(server, /__rivetAttribute\("class", __rivetClass\("a", \{ "on": p\.on, "is-big": p\.big\(\) \}\)\)/);
  assert.match(server, /import \{ _class as __rivetClass \} from "@rivetjs\/runtime\/style"/);
  assert.match(dom, /__rivet_tpl\("<p id=x class=a>t"\)/);
  assert.match(dom, /__rivetBindClass\(_el\$1, "on", \(\) => p\.on\); __rivetBindClass\(_el\$1, "is-big", \(\) => p\.big\(\)\);/);
  assert.match(dom, /import \{ _bindClass as __rivetBindClass \} from "@rivetjs\/runtime\/style"/);
  assert.doesNotMatch(dom, /_bindClass as __rivetBindClass[^}]*\} from "@rivetjs\/runtime\/dom"/);
});

test("a dynamic class base with toggles is one merged class binding", () => {
  const { dom, server } = both(`export const A = (p: { c: string; on: boolean }) => <p class={p.c} class:on={p.on} />;`);
  assert.match(server, /__rivetAttribute\("class", __rivetClass\(p\.c, \{ "on": p\.on \}\)\)/);
  // Closure-free binding (OPT-D): hoisted writer, `p` passed as a capture.
  assert.match(dom, /const __rivetFx0 = \(_el\$1, p\) => __rivet_cls\(_el\$1, __rivetClass\(p\.c, \{ "on": p\.on \}\)\);/);
  assert.match(dom, /__rivet_fx1\(__rivetFx0, _el\$1, p\);/);
  assert.doesNotMatch(dom, /BindClass/);
});

test("class objects with static keys are toggles; arrays and other objects normalize at runtime", () => {
  const objects = both(`export const A = (p: { on: boolean; big: boolean }) => <p class={{ active: p.on, "is-big": p.big, plain: true }} />;`);
  assert.match(objects.server, /__rivetAttribute\("class", __rivetClass\(null, \{ "active": p\.on, "is-big": p\.big, "plain": true \}\)\)/);
  assert.match(objects.dom, /__rivet_tpl\("<p class=plain>"\)/);
  assert.match(objects.dom, /__rivetBindClass\(_el\$1, "active", \(\) => p\.on\); __rivetBindClass\(_el\$1, "is-big", \(\) => p\.big\);/);
  const arrays = both(`export const A = (p: { on: boolean; k: string }) => <p class={["a", p.on && "b", { [p.k]: p.on, "c d": p.on }]} />;`);
  assert.match(arrays.server, /__rivetAttribute\("class", __rivetClass\(\[ "a", p\.on && "b", \{ \[p\.k\]: p\.on, "c d": p\.on \} \]\)\)/);
  assert.match(
    arrays.dom,
    /const __rivetFx0 = \(_el\$1, p\) => __rivet_cls\(_el\$1, __rivetClass\(\[ "a", p\.on && "b", \{ \[p\.k\]: p\.on, "c d": p\.on \} \]\)\);/,
  );
  assert.match(arrays.dom, /__rivet_fx1\(__rivetFx0, _el\$1, p\);/);
  // Literal-only arrays / objects join at compile time.
  const statics = both(`export const A = () => <p class={["a", ["b", null], { c: true, d: false }, false]} />;`);
  assert.match(statics.server, /"<p class=\\"a b c\\"><\/p>"/);
  assert.match(statics.dom, /export const A = \(\) => __rivetTpl0\(\);/);
  assert.match(statics.dom, /__rivet_tpl\("<p class=\\"a b c\\">"\)/);
});

test("dynamic style: values and style objects", () => {
  const { dom, server } = both(`export const A = (p: { c: string; s: Record<string, string> }) => <p style:color={p.c} style={p.s} />;`);
  assert.match(server, /__rivetStyleAttr\("style", __rivetStyle\(\{ "color": p\.c \}, p\.s\)\)/);
  assert.match(server, /import \{[^}]*_styleAttr as __rivetStyleAttr[^}]*\} from "@rivetjs\/runtime\/style"/);
  assert.match(dom, /__rivetBindStyle\(_el\$1, "color", \(\) => p\.c\); __rivetBindStyle\(_el\$1, null, \(\) => p\.s\);/);
  const literal = both(`export const A = (p: { v: number }) => <p style={{ "--rv-x": p.v, backgroundColor: "red" }} />;`);
  assert.match(literal.server, /__rivetStyle\(\{ "--rv-x": p\.v, "background-color": "red" \}\)/);
  assert.match(literal.dom, /__rivetBindStyle\(_el\$1, "--rv-x", \(\) => p\.v\); __rivetBindStyle\(_el\$1, "background-color", "red"\);/);
  const computed = both(`export const A = (p: { k: string; v: string }) => <p style={{ [p.k]: p.v, ...p }} />;`);
  assert.match(computed.server, /__rivetStyle\(\{ \[p\.k\]: p\.v, \.\.\.p \}\)/);
  assert.match(computed.dom, /__rivetBindStyle\(_el\$1, null, \(\) => \(\{ \[p\.k\]: p\.v, \.\.\.p \}\)\)/);
});

test("spread elements: class: toggles merge into the spread class; the style group joins the object (MATRIX-1)", () => {
  const { dom, server } = both(
    `export const A = (p: { rest: object; on: boolean; c: string }) => <p {...p.rest} class:on={p.on} style:color={p.c} class={{ x: p.on }} />;`,
  );
  const object = String.raw`__rivetSpreadClass\(\{ \.\.\.p\.rest, "style": \{ "color": p\.c \}, "class": __rivetClass\(\{ x: p\.on \}\) \}, \{ "on": p\.on \}\)`;
  assert.match(server, new RegExp(String.raw`__rivetSpreadAttributes\(` + object + String.raw`, "p"\)`));
  assert.doesNotMatch(server, /StyleAttr/);
  assert.match(dom, new RegExp(String.raw`__rivet_spread\(_el\$1, \(\) => ` + object + String.raw`, 1\)`));
  assert.doesNotMatch(dom, /BindStyle/);
});

test("style strings stay rejected; unsafe static values and invalid properties are compile errors", () => {
  const strings = 'style strings are not supported: use a style object (style={{ color: c, "--x": v }}) or style:color={c}';
  assert.deepEqual(messages(`export const A = () => <p style="color: red" />;`), [strings]);
  assert.deepEqual(messages(`export const A = () => <p style={"color: red"} />;`, "dom"), [strings]);
  assert.deepEqual(messages("export const A = (c: string) => <p style={`color: ${c}`} />;"), [strings]);
  const unsafe = (p: string) =>
    `Unsafe style value for ${p}: url(), src(), image-set(), expression(), javascript: and \\ ; { } /* are not allowed in style values`;
  assert.deepEqual(messages(`export const A = () => <p style:background="url(x.png)" />;`), [unsafe("background")]);
  assert.deepEqual(messages(`export const A = () => <p style={{ backgroundImage: "URL( x )" }} />;`, "dom"), [unsafe("background-image")]);
  assert.deepEqual(messages(`export const A = () => <p style={{ "--x": "expression(alert(1))" }} />;`), [unsafe("--x")]);
  assert.deepEqual(messages(`export const A = () => <p style:color={"red; background: blue"} />;`), [unsafe("color")]);
  assert.deepEqual(messages(`export const A = () => <p style:width="javascript:x" />;`, "dom"), [unsafe("width")]);
  assert.deepEqual(messages(`export const A = () => <p style={{ "a;b": 1 }} />;`), ["Invalid style property: a;b"]);
  assert.deepEqual(messages(`export const A = () => <p style={{ "--": 1 }} />;`, "dom"), ["Invalid style property: --"]);
  assert.deepEqual(messages(`export const A = () => <p style:color />;`), ["style:color needs a value"]);
  assert.deepEqual(messages(`export const A = (c: string) => <p class:on={true} className={c} class="a" />;`), [
    "Use one class attribute (class or className) per element",
  ]);
});

test("zero cost: plain class / no directives keep their output and import no helper", () => {
  for (const target of ["dom", "server"] as const) {
    const code = compile(`export const f = (c: () => string) => <div class={c()} title="t">x</div>;`, { target, filename: "a.tsx" }).code;
    assert.doesNotMatch(code, /Class|Style/, target);
  }
});

test("static markup folding and direct rendering skip elements with directives", () => {
  const { server } = both(`export const A = () => <ul>{[1, 2].map((n) => <li class:odd={n % 2 === 1}>{n}</li>)}</ul>;`);
  assert.match(server, /__rivetClass\(null, \{ "odd": n % 2 === 1 \}\)/);
});
