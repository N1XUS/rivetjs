// `_detach(root)` (runtime ABI, server streaming): a root leaves its parent — the parent's disposal no longer reaches
// it, its own disposer does; its context frames and the parent's remaining children are unaffected.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createRoot, createContext, provide, useContext, getOwner, onCleanup, runWithOwner, _detach } from "@rivetjs/reactivity";

test("a detached root outlives its parent, keeps its context frames, and is disposed once by its own disposer", () => {
  const T = createContext("default");
  const log: string[] = [];
  const parent = createRoot(() =>
    provide(T, "provided", () => {
      createRoot(() => onCleanup(() => log.push("older")));
      const child = createRoot(() => (onCleanup(() => log.push("detached")), getOwner()));
      createRoot(() => onCleanup(() => log.push("newer")));
      _detach(child.value);
      return child;
    }),
  );
  const child = parent.value;
  parent.dispose();
  assert.deepEqual(log, ["older", "newer"], "the parent's other children go with it, the detached one stays");
  assert.equal(
    runWithOwner(child.value, () => useContext(T)),
    "provided",
  );
  child.dispose();
  child.dispose();
  assert.deepEqual(log, ["older", "newer", "detached"]);
});

test("disposing a detached root first leaves its former parent's child list intact", () => {
  const log: string[] = [];
  const parent = createRoot(() => {
    createRoot(() => onCleanup(() => log.push("a")));
    const child = createRoot(() => (onCleanup(() => log.push("child")), getOwner()));
    createRoot(() => onCleanup(() => log.push("b")));
    _detach(child.value);
    return child;
  });
  parent.value.dispose();
  assert.deepEqual(log, ["child"]);
  parent.dispose();
  assert.deepEqual(log, ["child", "a", "b"]);
});

test("detaching the newest child (the head of its parent's list) keeps the older children with the parent", () => {
  const log: string[] = [];
  const parent = createRoot(() => {
    createRoot(() => onCleanup(() => log.push("a")));
    createRoot(() => onCleanup(() => log.push("b")));
    const child = createRoot(() => (onCleanup(() => log.push("child")), getOwner()));
    _detach(child.value);
    return child;
  });
  parent.dispose();
  assert.deepEqual(log, ["a", "b"]);
  parent.value.dispose();
  assert.deepEqual(log, ["a", "b", "child"]);
});

test("detaching an already disposed root is a no-op: its former siblings stay linked", () => {
  const log: string[] = [];
  const parent = createRoot(() => {
    createRoot(() => onCleanup(() => log.push("a")));
    const child = createRoot(() => (onCleanup(() => log.push("child")), getOwner()));
    createRoot(() => onCleanup(() => log.push("b")));
    child.dispose();
    _detach(child.value);
    return child;
  });
  assert.deepEqual(log, ["child"]);
  parent.dispose();
  assert.deepEqual(log, ["child", "a", "b"]);
});
