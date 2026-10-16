import { test } from 'vitest';
import assert from 'node:assert/strict';
import { signal, computed, effect, batch, createRoot, catchError, getOwner, onCleanup, _handleError } from '@rivetjs/reactivity';

test('catchError handles a synchronous throw and returns undefined', () => {
  const seen: unknown[] = [];
  const value = createRoot(() => catchError(() => { throw new Error('sync'); }, (error) => seen.push(error)));
  assert.equal(value.value, undefined);
  assert.deepEqual(seen.map((e) => (e as Error).message), ['sync']);
  assert.equal(createRoot(() => catchError(() => 7, () => assert.fail('no error'))).value, 7);
});

test('effect errors during a flush go to the nearest handler, not to the writer', () => {
  const n = signal(0), outer: unknown[] = [], inner: unknown[] = [];
  createRoot(() =>
    catchError(() => {
      effect(() => { if (n() === 1) throw new Error('outer effect'); });
      catchError(() => {
        effect(() => { if (n() === 2) throw new Error('inner effect'); });
      }, (error) => inner.push((error as Error).message));
    }, (error) => outer.push((error as Error).message)),
  );
  n.set(1);
  n.set(2);
  assert.deepEqual(outer, ['outer effect']);
  assert.deepEqual(inner, ['inner effect']);
  // batch and update paths too
  batch(() => n.set(1));
  assert.deepEqual(outer, ['outer effect', 'outer effect']);
});

test('a throwing handler forwards to the next handler; unhandled errors still reach the writer', () => {
  const n = signal(0), seen: string[] = [];
  createRoot(() =>
    catchError(() => {
      catchError(() => {
        effect(() => { if (n()) throw new Error('first'); });
      }, (error) => { throw new Error('rethrown ' + (error as Error).message); });
    }, (error) => seen.push((error as Error).message)),
  );
  n.set(1);
  assert.deepEqual(seen, ['rethrown first']);
  const m = signal(0);
  createRoot(() => effect(() => { if (m()) throw new Error('unhandled'); }));
  assert.throws(() => m.set(1), /unhandled/);
});

test('computed errors read by an effect are handled; handler writes flush in the same pass', () => {
  const n = signal(0), failed = signal<string | null>(null), log: string[] = [];
  const c = computed(() => { if (n() > 0) throw new Error('computed ' + n()); return n(); });
  createRoot(() => {
    effect(() => log.push('failed=' + failed()));
    catchError(() => effect(() => { c(); }), (error) => failed.set((error as Error).message));
  });
  n.set(1);
  assert.deepEqual(log, ['failed=null', 'failed=computed 1']);
});

test('_handleError routes an error to a captured owner, rethrowing without a handler', () => {
  const seen: unknown[] = [];
  const owner = createRoot(() => catchError(() => getOwner(), (error) => seen.push(error))).value;
  _handleError('late', owner!);
  assert.deepEqual(seen, ['late']);
  const bare = createRoot(() => getOwner()).value;
  assert.throws(() => _handleError(new Error('bare'), bare), /bare/);
  assert.throws(() => _handleError(new Error('none'), null), /none/);
});

test('cleanup errors of a re-running effect go to the handler', () => {
  const n = signal(0), seen: string[] = [];
  createRoot(() =>
    catchError(() => effect(() => { n(); onCleanup(() => { throw new Error('cleanup'); }); }), (error) => seen.push((error as Error).message)),
  );
  n.set(1);
  assert.deepEqual(seen, ['cleanup']);
});
