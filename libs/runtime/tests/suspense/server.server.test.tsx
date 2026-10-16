// Server suite for Suspense (ordered renders). Streaming resumable renders: ../suspense-stream.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Nested, Pair, Sync } from "./components.tsx";

test("ordered renders await every Async below a Suspense in place; fallbacks never render", async () => {
  assert.equal(await renderToString(() => <Pair a={Promise.resolve("A")} b={Promise.resolve("B")} />), '<main><b class="a">A</b><b class="b">B</b></main>');
  assert.equal(await renderToString(() => <Nested outer={Promise.resolve("o")} inner={Promise.resolve("i")} />), '<div><b class="outer">o</b><b class="inner">i</b></div>');
  assert.equal(await renderToString(() => <Sync />), "<b>now</b>");
});
