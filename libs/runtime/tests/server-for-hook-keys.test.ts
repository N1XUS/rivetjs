// The resumable (row hook) path of server For: keys reach the hook in row order and repeat as with a Set (SameValueZero)
// — small integer ids use a byte map, the rest one Set (FIX-CORE 2026-11-01).
import { test } from "vitest";
import assert from "node:assert/strict";
import { For, _onForRow } from "../server-structural.ts";

const seen: unknown[] = [];
_onForRow(
  (_list, _item, key, _index, render) => (
    seen.push(key),
    render(
      () => null,
      () => 0,
    )
  ),
);

const keysOf = (items: unknown[], by: (item: unknown, index: number) => unknown = (k) => k): unknown[] | "dup" => {
  seen.length = 0;
  try {
    For({ each: items, by, children: () => null });
  } catch (error) {
    assert.equal((error as Error).message, "Duplicate For key");
    return "dup";
  }
  return [...seen];
};

test("row hook keys: row order, SameValueZero duplicates, byte map and Set never disagree", () => {
  const ids = Array.from({ length: 300 }, (_, i) => i + 1);
  assert.deepEqual(keysOf(ids), ids);
  assert.equal(keysOf([...ids, 150]), "dup");
  assert.deepEqual(keysOf([100000, 5, 7]), [100000, 5, 7]);
  assert.equal(keysOf([100000, 5, 100000]), "dup");
  assert.equal(keysOf([0, -0]), "dup");
  assert.equal(keysOf([NaN, NaN]), "dup");
  assert.deepEqual(keysOf([1, "1", 1n, true]), [1, "1", 1n, true]);
  assert.equal(keysOf([1.5, 1.5]), "dup");
  assert.deepEqual(keysOf([2 ** 32, 0]), [2 ** 32, 0]);
  assert.equal(keysOf([-1, -1]), "dup");
  assert.deepEqual(
    keysOf([{ id: 1 }, { id: 2 }], (x) => (x as { id: number }).id),
    [1, 2],
  );
});
