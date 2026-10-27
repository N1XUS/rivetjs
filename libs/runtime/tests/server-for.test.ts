import { test } from "vitest";
import assert from "node:assert/strict";
import * as server from "../server.ts";
import { createContext, getOwner, onCleanup, provide, useContext } from "@rivetjs/reactivity";

// Non-resume server For (no `server-resume` module loaded, so no row hook): rows run under the For's
// own root — no per-row root, scoped record or admission — and render like `.map` (lane P1).

test("non-resume server For rows share the For root and keep context + cleanup semantics", async () => {
  const theme = createContext("default");
  const owners: unknown[] = [];
  let cleaned = 0;
  const list = provide(theme, "dark", () =>
    server.For({
      each: () => ["a", "b", "c"],
      by: (item: string) => item,
      children: (item: () => string, index: () => number) => {
        owners.push(getOwner());
        onCleanup(() => cleaned++);
        return server.template(["<i>", "</i>"], [`${item()}${index()}${useContext(theme)}`]);
      },
    }),
  );
  assert.equal(owners.length, 3);
  assert.notEqual(owners[0], null);
  assert.ok(
    owners.every((owner) => owner === owners[0]),
    "rows share one owner",
  );
  assert.equal(cleaned, 0);
  assert.equal(await server.renderToString(list), "<i>a0dark</i><i>b1dark</i><i>c2dark</i>");
  assert.equal(cleaned, 3);
  assert.equal(getOwner(), null);
});

test("non-resume server For keeps the array, duplicate-key and row-error rules", () => {
  assert.throws(() => server.For({ each: () => "ab" as unknown as string[], by: (x: string) => x, children: () => null }), /must return an array/);
  let setup = 0;
  assert.throws(
    () =>
      server.For({
        each: () => [1, 2, 1],
        by: (x: number) => x,
        children: () => {
          setup++;
          return null;
        },
      }),
    /Duplicate For key/,
  );
  assert.equal(setup, 0, "keys are checked before any row runs");
  let cleaned = 0;
  assert.throws(
    () =>
      server.For({
        each: () => ["a", "b"],
        by: (x: string) => x,
        children: (item: () => string) => {
          onCleanup(() => cleaned++);
          if (item() === "b") throw new Error("row setup");
          return item();
        },
      }),
    /row setup/,
  );
  assert.equal(cleaned, 2, "a failing row disposes the For root with every row's cleanups");
  assert.equal(getOwner(), null);
});

test("_forKeys: duplicate keys throw as with a Set (SameValueZero), small integer ids and other keys never collide", async () => {
  const { _forKeys } = await import("../server-structural.ts");
  const dup = (keys: unknown[]) => {
    try {
      _forKeys(keys, (k) => k);
      return false;
    } catch (error) {
      assert.equal((error as Error).message, "Duplicate For key");
      return true;
    }
  };
  assert.equal(dup([0, 1, 2, 3]), false);
  assert.equal(dup([0, 1, 2, 1]), true);
  assert.equal(dup([0, -0]), true);
  assert.equal(dup([NaN, NaN]), true);
  assert.equal(dup([1, "1", 1n, true]), false);
  assert.equal(dup([1.5, 1.5]), true);
  assert.equal(dup([1e9, 1e9]), true);
  assert.equal(dup([2 ** 32, 0]), false);
  assert.equal(dup([-1, -1]), true);
  // Past the byte map's size (4 × length + 64): the Set answers.
  assert.equal(dup([500, 3, 500]), true);
  const o = {};
  assert.equal(dup([o, {}, o]), true);
  // Holes: reported (derived rows), `by` still sees each index once in order.
  const seen: number[] = [];
  // eslint-disable-next-line no-sparse-arrays
  assert.equal(
    _forKeys([1, , 3], (_, i) => (seen.push(i), i), true),
    false,
  );
  assert.deepEqual(seen, [0, 1, 2]);
  assert.equal(
    _forKeys([1, 2, 3], (_, i) => i, true),
    true,
  );
});
