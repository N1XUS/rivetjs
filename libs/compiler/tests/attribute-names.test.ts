// Literal attribute encoding (`rust/src/html.rs` `encode_attribute`): HTML names are written lowercase
// as the HTML parser stores them (React-style `encType` / `readOnly` / `tabIndex`), SVG / MathML names
// keep their case, and `hidden` keeps a non-empty string keyword (`until-found`) — the same rules as
// the server runtime (`libs/runtime/template.ts`) for dynamic values.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const source = `export function A() {
  return <form encType="multipart/form-data" noValidate>
    <input readOnly tabIndex="2" maxLength="4" autoComplete="off" />
    <p hidden="until-found">a</p><p hidden>b</p><p hidden="">c</p>
    <svg viewBox="0 0 1 1" preserveAspectRatio="none"><path strokeLinecap="round" /></svg>
    <video crossOrigin="anonymous" playsInline />
  </form>;
}`;

test("server: literal HTML attribute names lowercase, SVG names verbatim, hidden keyword kept", () => {
  const { code, diagnostics } = compile(source, { target: "server", filename: "a.tsx" });
  assert.deepEqual(diagnostics, []);
  const html = code.replace(/\\"/g, '"');
  assert.match(html, /<form enctype="multipart\/form-data" novalidate><input readonly tabindex="2" maxlength="4" autocomplete="off">/);
  assert.match(html, /<p hidden="until-found">a<\/p><p hidden>b<\/p><p>c<\/p>/);
  assert.match(html, /<svg viewBox="0 0 1 1" preserveAspectRatio="none"><path strokeLinecap="round"><\/path><\/svg>/);
  assert.match(html, /<video crossorigin="anonymous" playsinline>/);
  assert.doesNotMatch(html, /encType|readOnly|tabIndex|noValidate/);
});

test("dom: template HTML follows the same rules", () => {
  const { code, diagnostics } = compile(source, { target: "dom", filename: "a.tsx" });
  assert.deepEqual(diagnostics, []);
  const html = code.replace(/\\"/g, '"');
  assert.match(html, /<form enctype=multipart\/form-data novalidate>/);
  assert.match(html, /<p hidden=until-found>a/);
  assert.match(html, /<svg viewBox="0 0 1 1"/);
  assert.doesNotMatch(html, /encType|readOnly|noValidate/);
});
