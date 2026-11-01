import assert from "node:assert/strict";
import { test } from "vitest";
import { createEncoder, createDecoder } from "../resume-format.ts";

// A nested `plain()` attempt hands its undo journal (one entry per interned value) to the enclosing attempt. A large
// nested value must not change the encoding (a spread of the journal into call arguments overflows past ~100k entries).
test("a large value inside nested plain() attempts encodes as plain data", () => {
  // A Map: every key / value is interned on its own (an array of strings would be one literal entry).
  const big = new Map(Array.from({ length: 200_000 }, (_, i) => [i, "v" + i] as const));
  const inner = { tag: "inner", big };
  const outer = { tag: "outer", inner };
  let attempts = 0;
  const { ref, table } = createEncoder({
    json: false,
    special: (value, _ref, plain) => {
      if (value !== inner && value !== outer) return undefined;
      attempts++;
      const entry = plain(value);
      assert.notEqual(entry, undefined, "plain attempt failed for " + (value as { tag: string }).tag);
      return entry;
    },
  });
  const root = ref(outer);
  assert.equal(attempts, 2);
  const decoded = createDecoder(table).get(root) as typeof outer;
  assert.equal(decoded.inner.big.size, 200_000);
  assert.equal(decoded.inner.big.get(199_999), "v199999");
});
