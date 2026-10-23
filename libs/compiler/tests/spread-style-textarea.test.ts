// Spread elements (user ruling 2026-10-06, `rust/src/compile.rs` exceptions): a plain `style` attribute
// merges into the spread object (source order, later wins) so the element gets ONE style attribute on
// the server and one style binding in the DOM `_spread` object; a spread `<textarea>` renders its `value` /
// `defaultValue` as RCDATA content on the server (`spreadChildren` slot), never as a `value` attribute.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";
import { renderToString, type ServerValue } from "../../runtime/server.ts";
import { importServer } from "../../runtime/tests/resume/compile.ts";

const squash = (code: string) => code.replace(/\s+/g, " ");
const build = (source: string, options: Record<string, unknown>) => {
  const result = compile(source, { filename: "a.tsx", ...options });
  assert.deepEqual(result.diagnostics, []);
  return result.code;
};

const styled = `export const A = (p: { a: object; c: string }) => <p {...p.a} style={{ color: p.c }}>x</p>;`;

test("spread + style: style merges into the spread object (server, dom) — no separate style binding", () => {
  const server = squash(build(styled, { target: "server" }));
  assert.match(server, /__rivetSpreadAttributes\(\{ \.\.\.p\.a, "style": \{ color: p\.c \} \}, "p"\)/);
  assert.doesNotMatch(server, /StyleAttr/);
  const dom = squash(build(styled, { target: "dom" }));
  // IMPL-SPREAD F1: a `style` after the last spread is a trailing `_attrs` value (style object writer), excluded from the spread.
  assert.match(
    dom,
    /__rivet_spread\(_el\$1, \(\) => \(\{ \.\.\.p\.a \}\), 0, null, "style"\); __rivet_attrs\(_el\$1, \(\) => \[\{ color: p\.c \}\], "style"\)/,
  );
  assert.doesNotMatch(dom, /_bindStyle/);
});

test("spread + style renders one style attribute, later source position wins", async () => {
  const module = await importServer<Record<string, () => ServerValue>>(
    build(
      `const red = { style: { color: "red" }, id: "a" };
export const after = () => <p {...red} style={{ color: "blue" }}>x</p>;
export const before = () => <p style={{ color: "blue" }} {...red}>x</p>;
export const both = () => <p {...red} style={{ marginTop: "1px" }} />;`,
      { target: "server" },
    ),
  );
  // Object key order: `style` keeps the position it first had in the merged object, the later value wins.
  assert.equal(await renderToString(module.after!), `<p style="color:blue" id="a">x</p>`);
  assert.equal(await renderToString(module.before!), `<p style="color:red" id="a">x</p>`);
  assert.equal(await renderToString(module.both!), `<p style="margin-top:1px" id="a"></p>`);
});

test("spread + style keeps the compile-time style checks; style: directives join the spread object (MATRIX-1)", () => {
  const messages = (source: string) => compile(source, { target: "server", filename: "a.tsx" }).diagnostics.map((d) => d.message);
  assert.deepEqual(messages(`export const A = (p: object) => <p {...p} style="color: red" />;`), [
    'style strings are not supported: use a style object (style={{ color: c, "--x": v }}) or style:color={c}',
  ]);
  assert.deepEqual(messages(`export const A = (p: object) => <p {...p} style={{ background: "url(x)" }} />;`), [
    "Unsafe style value for background: url(), src(), image-set(), expression(), javascript: and \\ ; { } /* are not allowed in style values",
  ]);
  const directive = squash(build(`export const A = (p: { a: object; c: string }) => <p {...p.a} style:color={p.c} />;`, { target: "server" }));
  assert.match(directive, /__rivetSpreadAttributes\(\{ \.\.\.p\.a, "style": \{ "color": p\.c \} \}, "p"\)/);
  assert.doesNotMatch(directive, /StyleAttr/);
});

test("spread textarea: value / defaultValue render as escaped RCDATA content on the server, no value attribute", async () => {
  const server = squash(build(`export const T = (p: object) => <textarea {...p} />;`, { target: "server" }));
  assert.match(server, /__rivetSpreadAttributes\(\{ \.\.\.p \}, "textarea"\), __rivetSpreadChildren\(\) ?\]/);
  const module = await importServer<Record<string, () => ServerValue>>(
    build(
      `const bag = { id: "s", value: () => "a<b\\nc" };
export const value = () => <textarea {...bag} />;
export const initial = () => <textarea {...{ defaultValue: "d", name: "n" }} />;
export const explicit = () => <textarea {...{ id: "e" }} value="v" />;
export const none = () => <textarea {...{ id: "z" }} />;`,
      { target: "server" },
    ),
  );
  assert.equal(await renderToString(module.value!), `<textarea id="s">\na&lt;b\nc</textarea>`);
  assert.equal(await renderToString(module.initial!), `<textarea name="n">\nd</textarea>`);
  assert.equal(await renderToString(module.explicit!), `<textarea id="e">\nv</textarea>`);
  assert.equal(await renderToString(module.none!), `<textarea id="z">\n</textarea>`);
  // The DOM target has no spread-children slot (`_spread` writes the value).
  assert.doesNotMatch(build(`export const T = (p: object) => <textarea {...p} />;`, { target: "dom" }), /spreadChildren/);
});
