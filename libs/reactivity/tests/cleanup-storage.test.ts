import { test } from 'vitest';
import assert from 'node:assert/strict';
import { signal, effect, computed, createRoot, onCleanup, getOwner, runWithOwner, createContext, provide, useContext, _dispose } from '@rivetjs/reactivity';
import type { Owner } from '../index.ts';

test('effect cleanup transitions between none, one and several callbacks in registration order', () => {
  const count = signal(0), seen: string[] = [];
  const stop = effect(() => {
    const n = count();
    for (let i = 0; i < n; i++) onCleanup(() => seen.push(n + ':' + i));
  });
  count.set(1);
  count.set(3);
  count.set(1);
  count.set(0);
  stop(); stop();
  assert.deepEqual(seen, ['1:0', '3:0', '3:1', '3:2', '1:0']);
});

test('a throwing single cleanup or first cleanup still releases all siblings once', () => {
  for (const count of [1, 3]) {
    const seen: number[] = [];
    const failure = new Error('cleanup failed');
    const root = createRoot(() => {
      createRoot(() => {
        for (let i = 0; i < count; i++) onCleanup(() => {
          seen.push(i);
          if (i === 0) throw failure;
        });
      });
      createRoot(() => onCleanup(() => seen.push(10)));
      onCleanup(() => seen.push(20));
    });
    assert.throws(root.dispose, (error) => error === failure);
    root.dispose();
    assert.deepEqual(seen, count === 1 ? [0, 10, 20] : [0, 1, 2, 10, 20]);
  }
});

test('cleanup can dispose its parent reentrantly without repeating or skipping callbacks', () => {
  const state = signal(0), seen: string[] = [];
  let stopParent!: () => void;
  const root = createRoot((stop) => {
    stopParent = stop;
    onCleanup(() => seen.push('parent'));
    effect(() => {
      seen.push('run ' + state());
      onCleanup(() => { seen.push('first'); stopParent(); });
      onCleanup(() => seen.push('second'));
    });
  });
  state.set(1);
  root.dispose(); state.set(2);
  assert.deepEqual(seen, ['run 0', 'first', 'parent', 'second']);
});

test('nested cleanup work restores owner context and never subscribes the cleaning effect', () => {
  const token = createContext('default'), trigger = signal(0), ignored = signal(0);
  const contexts: string[] = [];
  let captured: Owner | null = null, runs = 0, nestedCleanups = 0;
  const root = createRoot(() => provide(token, 'outer', () => {
    captured = getOwner();
    effect(() => {
      trigger(); runs++;
      onCleanup(() => {
        assert.equal(getOwner(), null);
        contexts.push(useContext(token)); ignored();
        const nested = createRoot(() => provide(token, 'nested', () => {
          contexts.push(useContext(token));
          onCleanup(() => nestedCleanups++);
        }));
        nested.dispose();
        assert.equal(getOwner(), null);
        contexts.push(useContext(token));
      });
    });
  }));
  runWithOwner(captured, () => {
    trigger.set(1);
    assert.equal(getOwner(), captured);
    assert.equal(useContext(token), 'outer');
  });
  ignored.set(1);
  assert.equal(runs, 2);
  root.dispose();
  assert.equal(nestedCleanups, 2);
  assert.deepEqual(contexts, ['default', 'nested', 'default', 'default', 'nested', 'default']);
  assert.equal(getOwner(), null);
});

test("onCleanup rejects a non-function at registration, not at dispose", () => {
  const root = createRoot((dispose) => {
    assert.throws(() => onCleanup(42 as never), (error: unknown) => error instanceof TypeError && /onCleanup requires a function/.test((error as Error).message));
    assert.throws(() => onCleanup(undefined as never), TypeError);
    return dispose;
  });
  // Nothing invalid was stored: dispose runs cleanly.
  root.value();
});

test("dispose releases a reactive node's function (closures holding DOM / data are collectable)", () => {
  const big = { payload: new Array(16).fill(0) };
  let node: { fn?: unknown } | null = null;
  const fn = () => {
    node = getOwner() as never;
    void big.payload.length;
  };
  const stop = effect(fn);
  // The node's function (the development façade wraps it) is held while live, released on dispose.
  const held = node!.fn;
  assert.equal(typeof held, "function");
  stop();
  assert.notEqual(node!.fn, held);
  // A disposed computed keeps its last value (reads stay stable) but drops its function.
  const s = signal(1);
  let c!: () => number;
  const r = createRoot((dispose) => {
    c = computed(() => s() * 2);
    assert.equal(c(), 2);
    return dispose;
  });
  r.value();
  assert.equal(c(), 2);
});

test("cleanups that dispose neighbouring owners during dispose / re-run terminate and run", () => {
  // Random owner trees (roots, effects, computeds) whose cleanups dispose a neighbouring owner. The
  // previous stack-based dispose could re-link a disposed parent's children, leaving a re-run looping.
  for (let seed = 1; seed <= 60; seed++) {
    let state = seed;
    const rand = () => ((state = (state * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const owners: unknown[] = [], cleaned = new Map<number, number>(), s = signal(0);
    let id = 0;
    const build = (depth: number) => {
      const n = Math.floor(rand() * 4);
      for (let i = 0; i < n; i++) {
        const me = id++, kind = rand();
        const body = () => {
          owners[me] = getOwner();
          const act = rand();
          onCleanup(() => {
            cleaned.set(me, (cleaned.get(me) ?? 0) + 1);
            const other = act < 0.15 ? owners[me + 1] : act > 0.9 ? owners[me - 1] : undefined;
            if (other) _dispose(other as never);
          });
          if (depth < 4) build(depth + 1);
        };
        if (kind < 0.4) createRoot(body);
        else if (kind < 0.7) effect(() => (rand() < 0.3 && s(), body()));
        else computed(() => (body(), 1))();
      }
    };
    const root = createRoot((dispose) => (build(0), dispose));
    s.set(1);
    root.value();
    for (const [, times] of cleaned) assert.ok(times >= 1);
    assert.ok([...cleaned.keys()].length > 0 || id === 0);
  }
});
