// Server-target suite: relative `.ts` imports of a server-target module carry the server target, so `.tsx`
// modules behind a `.ts` barrel compile for the server too (run by ../testing.test.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Toned } from "./barrel.ts";

test("a .tsx behind a relative .ts barrel compiles for the server", async () => {
  assert.equal(await renderToString(() => <Toned tone="warm" />), "<b><i>warm</i></b>");
});

test("package specifiers stay untagged (one runtime instance)", async () => {
  const self = await import("@rivetjs/runtime/testing/server");
  assert.ok(!import.meta.resolve("@rivetjs/runtime/testing/server").includes("rivet-target"));
  assert.equal(typeof self.renderToString, "function");
});
