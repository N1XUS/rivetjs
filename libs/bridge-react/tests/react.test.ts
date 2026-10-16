// T1 scaffold: the workspace resolves one React 19 copy for the adapter (dev pin 19.3.0, hoisted at the root).
import { test } from "vitest";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

test("react + react-dom resolve to one 19.3.0 copy", () => {
  const require = createRequire(new URL("../package.json", import.meta.url));
  const react = require("react/package.json"),
    dom = require("react-dom/package.json");
  assert.equal(react.version, "19.3.0");
  assert.equal(dom.version, "19.3.0");
  assert.equal(require.resolve("react"), createRequire(require.resolve("react-dom")).resolve("react"));
});
