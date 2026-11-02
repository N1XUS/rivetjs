// Dev HMR swaps through an async adapter (r3-races#9): superseded mounts never stay mounted.
import { test } from "vitest";
import assert from "node:assert/strict";
import { retireIsland, swapIsland, type DevIsland } from "../hot.ts";

function island() {
  const unmounted: unknown[] = [];
  const it = {
    key: "k",
    root: { replaceChildren() {} },
    adapter: { unmount: (h: unknown) => void unmounted.push(h) },
    handle: "old",
    swap() {},
  } as unknown as DevIsland;
  return { it, unmounted };
}
const later = () => {
  let resolve!: (value: unknown) => void;
  return { promise: new Promise((done) => (resolve = done)), resolve };
};

test("a second swap while the first mount is pending: old unmounted once, the superseded mount unmounted, the last one kept", async () => {
  const { it, unmounted } = island();
  const a = later(),
    b = later();
  const committed: unknown[] = [];
  swapIsland(
    it,
    () => a.promise,
    (next) => committed.push(next),
  );
  swapIsland(
    it,
    () => b.promise,
    (next) => committed.push(next),
  );
  b.resolve("b");
  await b.promise;
  a.resolve("a");
  await a.promise;
  await Promise.resolve();
  assert.deepEqual(unmounted, ["old", "a"]);
  assert.deepEqual(committed, ["b"]);
});

test("disposal while a mount is pending: the late mount is unmounted, the old handle not twice", async () => {
  const { it, unmounted } = island();
  const a = later();
  const committed: unknown[] = [];
  swapIsland(
    it,
    () => a.promise,
    (next) => committed.push(next),
  );
  retireIsland(it);
  a.resolve("a");
  await a.promise;
  await Promise.resolve();
  assert.deepEqual(unmounted, ["old", "a"]);
  assert.deepEqual(committed, []);
});

test("no swap pending: retire unmounts the handle", () => {
  const { it, unmounted } = island();
  retireIsland(it);
  assert.deepEqual(unmounted, ["old"]);
});
