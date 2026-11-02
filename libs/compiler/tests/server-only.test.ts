// `serverOnlyStub` must stay a parsable module for any export name (rc2#37: `export const class` is a syntax error).
import { test } from "vitest";
import assert from "node:assert/strict";
import { parseAst } from "vite";
import { isServerOnly, serverOnlyStub } from "../server-only.ts";

test("a reserved word export name still gives a parsable stub", () => {
  const code = serverOnlyStub("db.server.ts", [], ["class", "delete", "plain"]);
  parseAst(code);
  assert.match(code, /as "class"/);
  assert.match(code, /export const plain = /);
});

test("a query does not hide a server file", () => {
  assert.equal(isServerOnly([], "./db.server.ts?raw"), true);
  assert.equal(isServerOnly([], "./db.ts", "/a/db.server.ts?v=1"), true);
  assert.equal(isServerOnly([], "./db.ts?x=.server.ts"), false);
});
