// build-css header parsing: a component source's provenance header is copied into its out file. A multi-line header
// once kept only its first line, so the comment never closed and the out file compiled to nothing (UI-PORT S6).
import { test } from "vitest";
import assert from "node:assert/strict";
import { headerComments } from "../scripts/build-css.ts";

test("one-line headers on the first two lines are kept as written", () => {
  const source = "/* Ported from x.css */\n/* Rivet: tweaks */\n.a { color: red; }\n";
  assert.deepEqual(headerComments(source), ["/* Ported from x.css */", "/* Rivet: tweaks */"]);
});

test("a multi-line header is kept whole and stays closed", () => {
  const source = "/* Rivet-authored (UI-PORT): kanban board,\n   columns and cards. */\n.kanban { display: flex; }\n";
  const [header] = headerComments(source);
  assert.equal(header, "/* Rivet-authored (UI-PORT): kanban board,\n   columns and cards. */");
  assert.ok(header!.endsWith("*/"));
});

test("comments that are not provenance, or start after line two, are dropped", () => {
  assert.deepEqual(headerComments("/* layout notes */\n.a {}\n"), []);
  assert.deepEqual(headerComments(".a {}\n\n/* Rivet: late */\n"), []);
  assert.deepEqual(headerComments("/* x */\n/* y */\n/* Rivet: third line */\n.a {}\n"), []);
});

test("an unclosed header comment throws instead of emptying the out file", () => {
  assert.throws(() => headerComments("/* Rivet: no end\n.a { color: red; }\n", "broken"), /components\/broken\.css: unclosed header comment/);
});
