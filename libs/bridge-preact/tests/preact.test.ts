// T8 scaffold: the workspace resolves one Preact 11.0.1 copy (dev pin, hoisted at the root) for the adapter and the
// string renderer.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

test("preact + preact-render-to-string resolve to one Preact 11.0.1 copy", () => {
  const require = createRequire(new URL("../package.json", import.meta.url));
  assert.equal(require("preact/package.json").version, "11.0.1");
  assert.equal(require("preact-render-to-string/package.json").version, "6.8.0");
  assert.equal(require.resolve("preact"), createRequire(require.resolve("preact-render-to-string")).resolve("preact"));
});
