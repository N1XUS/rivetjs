import { test } from "vitest";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

test("Vue and server renderer resolve to the exact matching supported release", () => {
  const require = createRequire(new URL("../package.json", import.meta.url));
  assert.equal(require("vue/package.json").version, "3.5.43");
  assert.equal(require("@vue/server-renderer/package.json").version, "3.5.43");
  assert.equal(require.resolve("vue"), createRequire(require.resolve("@vue/server-renderer")).resolve("vue"));
});
