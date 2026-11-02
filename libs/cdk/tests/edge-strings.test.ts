// Rivet tests (FIX2-CDK, review r3-edges#15 / #16): string edge cases of collection builder errors and era prefixes.
import { test } from "vitest";
import assert from "node:assert/strict";
import { capitalize } from "../collections/builder.ts";
import { commonPrefixLength } from "../date-field/behaviour.tsx";

test("capitalize: empty string, ascii", () => {
  assert.equal(capitalize(""), "");
  assert.equal(capitalize("item"), "Item");
});

test("commonPrefixLength never splits a surrogate pair", () => {
  // U+1D400 / U+1D401 share the high surrogate \uD835.
  assert.equal(commonPrefixLength(["\u{1D400}a", "\u{1D401}b"]), 0);
  assert.equal(commonPrefixLength(["ERA0", "ERA1"]), 3);
  assert.equal(commonPrefixLength(["x\u{1D400}", "x\u{1D401}"]), 1);
});
