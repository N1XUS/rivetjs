import { test } from "vitest";
import assert from "node:assert/strict";
import { selectFields, summarize } from "../metrics.ts";

test("sparse updates are unique, deterministic, and spread across the page", () => {
  const selected = selectFields(50000, 1);
  assert.equal(selected.length, 500);
  assert.equal(new Set(selected).size, 500);
  assert.equal(selected[0], 0);
  assert.equal(selected.at(-1), 49900);
  assert.deepEqual(
    selectFields(10, 100),
    Array.from({ length: 10 }, (_, i) => i),
  );
  assert.throws(() => selectFields(0, 1));
  assert.throws(() => selectFields(10, 0));
});

test("summaries preserve sample count and extrema with median and nearest rank p95", () => {
  assert.deepEqual(summarize([8, 1, 4, 2]), { count: 4, min: 1, median: 3, p95: 8, max: 8 });
  assert.throws(() => summarize([]));
  assert.throws(() => summarize([NaN]));
});
