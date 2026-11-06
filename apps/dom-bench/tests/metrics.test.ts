import { test } from "vitest";
import assert from "node:assert/strict";
import { fieldRevisions, selectFields, summarize } from "../metrics.ts";

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

test("field texts parse in document order without node access", () => {
  const row = (r: number, revisions: number[]) =>
    `Row ${r}Ten independent reactive fields in a substantial page.` +
    revisions.map((v, k) => `Field ${k}value-${r * 10 + k}-${v}Increase`).join("") +
    "End of row";
  const text = row(0, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) + row(1, Array(10).fill(7));
  assert.deepEqual(fieldRevisions(text), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, ...Array(10).fill(7)]);
  assert.throws(() => fieldRevisions(row(1, [0])), /Incorrect field 0/);
  // A field text outside its caption / button (e.g. a stray text node) does not count as a field.
  assert.deepEqual(fieldRevisions("value-0-0" + row(0, [3])), [3]);
});
