import { test } from 'vitest';
import assert from 'node:assert/strict';
// Package specifier: `--conditions=development` runs these through the development façade.
import { signal, computed, effect, batch, createRoot } from '@rivetjs/reactivity';

const dev = import.meta.resolve('@rivetjs/reactivity').endsWith('/dev.ts');

// Owner-ordered flush: a queued effect never runs before a queued/dirty owner effect, which may
// dispose it (zombie child) or leave it alive (it then runs once, with fresh values).
for (const order of ['value first', 'condition first'] as const)
  test(`a child effect disposed by its re-running parent never observes the write that removes it (${order})`, () => {
    const v = signal<{ x: number } | null>({ x: 1 }), show = signal(true), log: unknown[] = [];
    const root = createRoot(() => effect(() => { if (show()) effect(() => { log.push(v()!.x); }); }));
    assert.deepEqual(log, [1]);
    batch(() => {
      if (order === 'value first') { v.set(null); show.set(false); }
      else { show.set(false); v.set(null); }
    });
    assert.deepEqual(log, [1]);
    batch(() => { v.set({ x: 2 }); show.set(true); });
    assert.deepEqual(log, [1, 2]);
    root.dispose();
  });

test('three-level nesting: the top-most dirty owner runs first, whichever levels are queued', () => {
  const v = signal<{ x: number } | null>({ x: 1 }), a = signal(true), b = signal(true), log: unknown[] = [];
  const root = createRoot(() => effect(() => {
    if (a()) effect(() => { if (b()) effect(() => { log.push(v()!.x); }); });
  }));
  batch(() => { v.set(null); a.set(false); });
  assert.deepEqual(log, [1]);
  batch(() => { v.set({ x: 2 }); a.set(true); });
  assert.deepEqual(log, [1, 2]);
  batch(() => { v.set(null); b.set(false); });
  assert.deepEqual(log, [1, 2]);
  batch(() => { b.set(true); v.set({ x: 3 }); });
  assert.deepEqual(log, [1, 2, 3]);
  // Grandchild, middle and top all queued, innermost first.
  batch(() => { v.set(null); b.set(false); a.set(false); });
  assert.deepEqual(log, [1, 2, 3]);
  root.dispose();
});

test('a child kept by its owner (owner check settles equal) runs exactly once with fresh data', () => {
  const n = signal(1), m = signal(0), log: string[] = [];
  const big = computed(() => n() > 10);
  const root = createRoot(() => effect(() => {
    log.push('parent ' + big());
    effect(() => { log.push('child ' + m()); });
  }));
  batch(() => { m.set(5); n.set(2); });
  assert.deepEqual(log, ['parent false', 'child 0', 'child 5']);
  root.dispose();
});

test('a re-running owner recreates its child, which runs once with fresh data; the old child never runs', () => {
  const n = signal(0), m = signal(0), log: string[] = [];
  const root = createRoot(() => effect(() => {
    log.push('parent ' + n());
    effect(() => { log.push('child ' + m()); });
  }));
  batch(() => { m.set(5); n.set(1); });
  assert.deepEqual(log, ['parent 0', 'child 0', 'parent 1', 'child 5']);
  root.dispose();
});

test('a child depending on its value through a computed is disposed before the computed is pulled', () => {
  const v = signal<{ x: number } | null>({ x: 1 }), show = signal(true), log: unknown[] = [];
  const x = computed(() => v()!.x);
  const root = createRoot(() => effect(() => { if (show()) effect(() => { log.push(x()); }); }));
  batch(() => { v.set(null); show.set(false); });
  assert.deepEqual(log, [1]);
  root.dispose();
});

test('unrelated queued effects keep their order around an owner-first run', () => {
  const v = signal(0), show = signal(true), log: string[] = [];
  const root = createRoot(() => {
    effect(() => { log.push('peer ' + v()); });
    effect(() => { log.push('parent ' + show()); if (show()) effect(() => { log.push('child ' + v()); }); });
  });
  log.length = 0;
  batch(() => { v.set(1); show.set(false); });
  assert.deepEqual(log, ['peer 1', 'parent false']);
  root.dispose();
});

// Lost errors: the first failure of a flush is rethrown, every other one is reported.
function captureReports(fn: () => void): unknown[] {
  const scope = globalThis as { reportError?: (error: unknown) => void };
  const previous = Object.getOwnPropertyDescriptor(scope, 'reportError'), reported: unknown[] = [];
  scope.reportError = (error) => void reported.push(error);
  try { fn(); } finally {
    if (previous) Object.defineProperty(scope, 'reportError', previous); else delete scope.reportError;
  }
  return reported;
}
for (const count of [2, 3])
  test(`a flush with ${count} failing effects rethrows the first and reports the others`, () => {
    const s = signal(0), errors = Array.from({ length: count }, (_, i) => new Error('failure ' + i));
    let peer = 0;
    const root = createRoot(() => {
      for (const error of errors) effect(() => { if (s()) throw error; });
      effect(() => { peer = s(); });
    });
    let thrown: unknown;
    const reported = captureReports(() => { try { s.set(1); } catch (error) { thrown = error; } });
    assert.equal(thrown, errors[0]);
    assert.equal(peer, 1);
    if (dev) {
      assert.equal(reported.length, 1);
      const aggregate = reported[0] as AggregateError;
      assert.ok(aggregate instanceof AggregateError);
      assert.deepEqual(aggregate.errors, errors);
      for (let i = 0; i < count; i++) assert.match(aggregate.message, new RegExp('failure ' + i));
      assert.match(aggregate.message, new RegExp(`${count} errors in one flush`));
    } else assert.deepEqual(reported, errors.slice(1));
    root.dispose();
  });

test('without reportError the other failures go to console.error; a single failure reports nothing', () => {
  const s = signal(0), logged: unknown[][] = [];
  const root = createRoot(() => {
    effect(() => { if (s()) throw new Error('first'); });
    effect(() => { if (s() === 1) throw new Error('second'); });
  });
  const scope = globalThis as { reportError?: unknown };
  const previous = Object.getOwnPropertyDescriptor(scope, 'reportError'), error = console.error;
  delete scope.reportError;
  console.error = (...args: unknown[]) => void logged.push(args);
  try {
    assert.throws(() => s.set(1), /first/);
    assert.equal(logged.length, 1);
    assert.match(String((logged[0][0] as Error).message), dev ? /second/ : /^second$/);
    logged.length = 0;
    assert.throws(() => s.set(2), /first/);
    assert.equal(logged.length, 0);
  } finally {
    console.error = error;
    if (previous) Object.defineProperty(scope, 'reportError', previous);
  }
  root.dispose();
});
