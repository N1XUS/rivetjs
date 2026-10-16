// Server-target suite for element refs: `ref()` is a no-op, `ref={…}` renders nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Canvas, Form, List, log } from "./components.tsx";

test("server: ref() reads undefined; ref attributes render nothing; clientEffect does not run", async () => {
  assert.equal(await renderToString(() => <Canvas />), '<canvas id="c" width="8"></canvas>');
  assert.deepEqual(log, ["setup:undefined"]);
  assert.match(await renderToString(() => <Form />), /<label>Name<input><\/label><label>Other<input><\/label><button type="button">focus<\/button><output>false<\/output>/);
  assert.equal(await renderToString(() => <List />), "<ul><li>a</li><li>b</li></ul>");
});
