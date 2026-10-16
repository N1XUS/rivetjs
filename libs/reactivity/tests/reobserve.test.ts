// `_observer` / `_reobserve` (runtime ABI for the cdk collection build pass): re-enter the running observer from
// an untracked scope so reads there become its dependencies.
import { test } from "vitest";
import assert from "node:assert/strict";
import { signal, computed, effect, untrack, _observer, _reobserve, _trackReads } from "@rivetjs/reactivity";

test("_reobserve makes reads inside untrack dependencies of the captured computed", () => {
  const a = signal(1);
  const b = signal(10);
  let runs = 0;
  const c = computed(() => {
    runs++;
    const observer = _observer();
    return untrack(() => a() + _reobserve(observer, () => b()));
  });
  assert.equal(c(), 11);
  a.set(2); // untracked: no recompute
  assert.equal(c(), 11);
  assert.equal(runs, 1);
  b.set(20); // re-entered: recompute
  assert.equal(c(), 22);
  assert.equal(runs, 2);
});

test("_reobserve re-enters an effect; _observer is null outside any observer and _reobserve(null) is untracked", () => {
  assert.equal(_observer(), null);
  const s = signal(0);
  const seen: number[] = [];
  const stop = effect(() => {
    const observer = _observer();
    untrack(() => _reobserve(observer, () => seen.push(s())));
  });
  s.set(1);
  assert.deepEqual(seen, [0, 1]);
  stop();
  const t = signal(0);
  let runs = 0;
  const c = computed(() => (runs++, _reobserve(null, () => t())));
  c();
  t.set(1);
  c();
  assert.equal(runs, 1);
});

test("_reobserve re-enters a _trackReads collector (server region recording)", () => {
  const a = signal(1);
  const b = signal(2);
  const { signals } = _trackReads(() => {
    const observer = _observer();
    return untrack(() => a() + _reobserve(observer, () => b()));
  });
  assert.deepEqual(signals, [b]);
});
