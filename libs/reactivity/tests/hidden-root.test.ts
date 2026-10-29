// `_hiddenRoot` (runtime ABI for the cdk collection build pass, RAC's hidden render): inside a running computed, `fn`
// runs tracked by it, may write signals, sees the computed's context, and what it creates survives the computed's next
// run until the returned root is disposed.
import { test } from "vitest";
import assert from "node:assert/strict";
import { signal, computed, effect, createContext, provide, useContext, onCleanup, _hiddenRoot, _dispose } from "@rivetjs/reactivity";

test("_hiddenRoot: writes allowed, reads tracked by the running computed", () => {
  const dep = signal(1);
  const roots: unknown[] = [];
  const c = computed(() => {
    let out = 0;
    roots.push(
      _hiddenRoot(() => {
        const local = signal(0);
        local.set(dep() * 10);
        out = local();
      }),
    );
    return out;
  });
  assert.equal(c(), 10);
  dep.set(2);
  assert.equal(c(), 20);
  // Nothing but a signal: nothing to dispose.
  assert.deepEqual(roots, [null, null]);
  // Outside the root the computed stays pure.
  const bad = computed(() => dep.set(3));
  assert.throws(() => bad(), /Signal writes are not allowed during computed evaluation/);
});

test("_hiddenRoot: owned work survives the computed's next run; context is the creation site's", () => {
  const token = createContext("default");
  const dep = signal(0);
  const disposed: number[] = [];
  const seen: string[] = [];
  let root: ReturnType<typeof _hiddenRoot> = null;
  const c = provide(token, "outer", () =>
    computed(() => {
      const run = dep();
      root = _hiddenRoot(() => {
        seen.push(useContext(token));
        onCleanup(() => disposed.push(run));
      });
      return run;
    }),
  );
  assert.equal(c(), 0);
  const first = root;
  assert.notEqual(first, null);
  dep.set(1);
  assert.equal(c(), 1);
  assert.deepEqual(disposed, []);
  _dispose(first);
  assert.deepEqual(disposed, [0]);
  _dispose(root);
  assert.deepEqual(disposed, [0, 1]);
  assert.deepEqual(seen, ["outer", "outer"]);
});

test("_hiddenRoot: an effect inside counts as owned work; a throw disposes the root and restores the guard", () => {
  const s = signal(0);
  const runs: number[] = [];
  const root = _hiddenRoot(() => void effect(() => void runs.push(s())));
  assert.notEqual(root, null);
  s.set(1);
  assert.deepEqual(runs, [0, 1]);
  _dispose(root);
  s.set(2);
  assert.deepEqual(runs, [0, 1]);
  const cleaned: string[] = [];
  const c = computed(() =>
    _hiddenRoot(() => {
      onCleanup(() => cleaned.push("x"));
      throw new Error("boom");
    }),
  );
  assert.throws(() => c(), /boom/);
  assert.deepEqual(cleaned, ["x"]);
  const after = computed(() => s.set(3));
  assert.throws(() => after(), /Signal writes are not allowed/);
});
