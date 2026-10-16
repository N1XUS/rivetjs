// `@rivetjs/runtime/escape`: the one HTML escaper (server renderer, router head/CSR/dev pages).
import { test } from "vitest";
import assert from "node:assert/strict";
import { escapeAttribute, escapeText } from "@rivetjs/runtime/escape";
import { escapeAttribute as templateAttribute, escapeText as templateText } from "../template.ts";
import { renderToString } from "../server.ts";

test("escapeText escapes &<> only; escapeAttribute also both quotes; clean strings pass through; values are coerced", () => {
  assert.equal(escapeText(`a & <b> "c" 'd'`), `a &amp; &lt;b&gt; "c" 'd'`);
  assert.equal(escapeAttribute(`a & <b> "c" 'd'`), "a &amp; &lt;b&gt; &quot;c&quot; &#39;d&#39;");
  const clean = "plain text";
  assert.equal(escapeText(clean), clean);
  assert.equal(escapeText(12), "12");
  assert.equal(escapeAttribute(null), "null");
});

test("template.ts and the server renderer use the same functions", () => {
  assert.equal(templateText, escapeText);
  assert.equal(templateAttribute, escapeAttribute);
  assert.equal(renderToString(() => `<x> & 'y'`), "&lt;x&gt; &amp; 'y'");
});
