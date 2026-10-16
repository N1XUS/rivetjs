import { test } from 'vitest';
import assert from 'node:assert/strict';
// Package specifier: `--conditions=development` runs these through the development façade.
const api = await import('@rivetjs/reactivity');
import type { Owner } from '../index.ts';
const {signal, computed, effect, batch, createRoot, onCleanup, untrack, createContext, provide, useContext} = api;

test('exports the synchronous runtime contracts', () => {
  for (const name of ['signal','computed','effect','batch','createRoot','onCleanup','untrack','createContext','provide','useContext','getOwner','runWithOwner']) assert.equal(typeof (api as Record<string, unknown>)[name], 'function', name);
});
test('signals set and update use Object.is equality', () => {
  const s = signal(1); const seen: number[] = []; const stop = effect(() => seen.push(s()));
  assert.equal(s.set(1), 1); assert.equal(s.update(v => v + 1), 2);
  stop(); s.set(3); assert.deepEqual(seen, [1,2]);
});
test('conditional dependencies switch without retaining the previous branch', () => {
  const toggle = signal(true), a = signal(1), b = signal(10); const seen: number[] = [];
  const stop = effect(() => seen.push(toggle() ? a() : b()));
  toggle.set(false); a.set(2); b.set(11); stop();
  assert.deepEqual(seen, [1,10,11]);
});
test('computed is lazy and diamond reads are coherent regardless of subscription order', () => {
  const s = signal(1); let calls = 0;
  const a = computed(() => { calls++; return s() * 2; });
  const b = computed(() => s() + a());
  assert.equal(calls, 0); const seen: number[][] = [];
  const stop = effect(() => seen.push([s(), b(), a()]));
  s.set(2); stop(); assert.deepEqual(seen, [[1,3,2],[2,6,4]]); assert.equal(calls,2);
});
test('computed dependencies switch and untrack excludes reads', () => {
  const flag = signal(true), a = signal(1), b = signal(2); let calls = 0;
  const c = computed(() => { calls++; return flag() ? a() : b(); }); const seen: number[][] = [];
  const stop = effect(() => seen.push([c(), untrack(() => a())]));
  flag.set(false); a.set(5); b.set(3); stop();
  assert.deepEqual(seen, [[1,1],[2,1],[3,5]]); assert.equal(calls, 3);
});
test('nested batches flush once and computed reads inside batches are fresh', () => {
  const s = signal(0), c = computed(() => s()*2); const seen: number[] = [];
  const stop = effect(() => seen.push(c()));
  assert.equal(batch(() => { s.set(1); batch(() => s.set(2)); assert.equal(c(),4); s.set(3); return 7; }),7);
  stop(); assert.deepEqual(seen,[0,6]);
});
test('reentrant effects settle and nested writes do not recurse', () => {
  const s = signal(0); const seen: number[] = []; let depth = 0, maximum = 0;
  const stop = effect(() => { depth++; maximum = Math.max(maximum,depth); const value = s(); seen.push(value); if(value<3) s.set(value+1); depth--; });
  stop(); assert.deepEqual(seen,[0,1,2,3]); assert.equal(maximum,1);
});
test('effects clean children and cleanups exactly once per run and on root disposal', () => {
  const s = signal(0), logs: string[] = [];
  const root = createRoot(() => {
    onCleanup(() => logs.push('root'));
    effect(() => { const n = s(); onCleanup(() => logs.push(`outer ${n}`)); effect(() => { onCleanup(() => logs.push(`child ${n}`)); }); });
    return 'value';
  });
  assert.equal(root.value,'value'); s.set(1); root.dispose(); root.dispose(); s.set(2);
  assert.deepEqual(logs,['child 0','outer 0','child 1','outer 1','root']);
});
test('thrown effects do not prevent queued peers or poison tracking', () => {
  const s = signal(0); let peer = 0; const root = createRoot(() => {
    effect(() => { if(s()===1) throw new Error('effect failure'); });
    effect(() => { peer = s(); });
  });
  assert.throws(() => s.set(1),/effect failure/); assert.equal(peer,1);
  s.set(2); assert.equal(peer,2); root.dispose();
});
test('batch callback failures still flush writes and restore scheduler state', () => {
  const s = signal(0); let value: number | undefined; const stop = effect(() => {value=s();});
  assert.throws(() => batch(() => { s.set(1); throw new Error('batch failure'); }),/batch failure/);
  assert.equal(value,1); s.set(2); assert.equal(value,2); stop();
});
test('failed root initialization disposes registered children', () => {
  const s = signal(0); let runs = 0, cleanups = 0;
  assert.throws(() => createRoot(() => { onCleanup(() => cleanups++); effect(() => { s(); runs++; }); throw new Error('root failure'); }),/root failure/);
  s.set(1); assert.equal(runs,1); assert.equal(cleanups,1);
});
test('cleanup failures still dispose every child and cleanup once', () => {
  let count = 0; const root = createRoot(() => {
    onCleanup(() => { count++; throw new Error('cleanup failure'); });
    onCleanup(() => count++); effect(() => onCleanup(() => count++));
  });
  assert.throws(root.dispose,/cleanup failure/); root.dispose(); assert.equal(count,3);
});
test('context shadows logically, persists on effect reruns, and isolates roots', () => {
  const token = createContext('default'), s = signal(0), seen: string[] = [];
  const first = createRoot(() => provide(token,'first',() => {
    effect(() => { s(); seen.push(useContext(token)); });
    assert.equal(provide(token,'inner',() => useContext(token)),'inner');
    assert.equal(useContext(token),'first');
  }));
  const second = createRoot(() => effect(() => { s(); seen.push(useContext(token)); }));
  s.set(1); first.dispose(); second.dispose(); assert.deepEqual(seen,['first','default','first','default']);
  assert.equal(useContext(token),'default');
});
test('ownership never spans await and onCleanup requires an owner', async () => {
  const token = createContext('default');
  const root = createRoot(() => provide(token,'scoped',async () => { assert.equal(useContext(token),'scoped'); await Promise.resolve(); return useContext(token); }));
  assert.equal(await root.value,'default'); root.dispose(); assert.throws(() => onCleanup(() => {}),/owner/i);
});
test('captured owners restore context for later synchronous callbacks and reject disposed scopes', async () => {
  const token = createContext('default'); let captured: Owner | null = null;
  const root = createRoot(() => provide(token,'captured',() => { captured = api.getOwner(); }));
  assert.equal(api.getOwner(), null);
  assert.equal(api.runWithOwner(captured,() => useContext(token)),'captured');
  const later = api.runWithOwner(captured,async () => { assert.equal(useContext(token),'captured'); await Promise.resolve(); return useContext(token); });
  assert.equal(api.getOwner(),null); assert.equal(await later,'default');
  root.dispose(); let called = false;
  assert.throws(() => api.runWithOwner(captured,() => {called=true;}),/disposed owner/i);
  assert.equal(called,false); assert.equal(api.getOwner(),null);
});
test('a failed computed keeps consumers subscribed for recovery', () => {
  const s = signal(0); const c = computed(() => { const n=s(); if(n===1) throw new Error('computed failure'); return n; });
  const seen: number[]=[]; const stop=effect(() => seen.push(c()));
  assert.throws(() => s.set(1),/computed failure/); s.set(2); stop();
  assert.deepEqual(seen,[0,2]);
});
test('root disposal cancels effects already queued in a batch', () => {
  const s=signal(0); let runs=0;
  const root=createRoot(() => effect(() => {s(); runs++;}));
  batch(() => {s.set(1); root.dispose();}); assert.equal(runs,1);
});
test('non-settling initial effects fail boundedly and release inaccessible subscriptions', () => {
  const s=signal(0);
  assert.throws(() => effect(() => s.set(s()+1)),/did not settle/);
  assert.doesNotThrow(() => s.set(0));
});
test('deep owner trees dispose without recursive stack growth', () => {
  let parent: Owner | null = null; let cleanups=0;
  const root=createRoot(() => {parent=api.getOwner(); onCleanup(() => cleanups++);});
  for(let i=0;i<12000;i++) api.runWithOwner(parent,() => createRoot(() => {parent=api.getOwner(); onCleanup(() => cleanups++);}));
  root.dispose(); root.dispose(); assert.equal(cleanups,12001);
});
test('rerun cleanup failures surface after resubscribing and still run peers and every cleanup', () => {
  const s=signal(0), seen: number[]=[], peer: number[]=[], cleaned: string[]=[];
  const root=createRoot(() => {
    effect(() => {
      const value=s(); seen.push(value);
      onCleanup(() => {cleaned.push(`first ${value}`); if(s()===1) throw new Error('rerun cleanup failure');});
      onCleanup(() => cleaned.push(`second ${value}`));
    });
    effect(() => peer.push(s()));
  });
  assert.throws(() => s.set(1),/rerun cleanup failure/);
  assert.deepEqual(seen,[0,1]); assert.deepEqual(peer,[0,1]);
  s.set(2); root.dispose(); root.dispose();
  assert.deepEqual(seen,[0,1,2]); assert.deepEqual(peer,[0,1,2]);
  assert.deepEqual(cleaned,['first 0','second 0','first 1','second 1','first 2','second 2']);
});
test('computed evaluation rejects writes before mutation and restores owner state for recovery', () => {
  const s=signal(2), token=createContext('default'), seen: number[]=[]; let captured: Owner | null = null;
  const root=createRoot(() => provide(token,'scoped',() => {
    captured=api.getOwner();
    const c=computed(() => {
      assert.equal(useContext(token),'scoped');
      const value=s(); if(value===0) s.set(1); return value;
    });
    effect(() => seen.push(c()));
  }));
  assert.throws(() => s.set(0),/writes.*computed evaluation/i);
  assert.equal(s(),0); assert.deepEqual(seen,[2]);
  assert.equal(api.getOwner(),null); assert.equal(useContext(token),'default');
  assert.equal(api.runWithOwner(captured,() => useContext(token)),'scoped');
  s.set(1); assert.deepEqual(seen,[2,1]); root.dispose();
});
test('untrack and update cannot bypass computed write diagnostics', () => {
  const s=signal(0); const root=createRoot(() => {
    const c=computed(() => untrack(() => s.update(value => value+1)));
    assert.throws(c,/writes.*computed evaluation/i); assert.equal(s(),0);
  });
  root.dispose(); assert.doesNotThrow(() => s.set(1)); assert.equal(s(),1);
});
test('computed equality cut-off: equal recomputes stop propagation; equals options customize it', () => {
  const s = signal(1), runs: number[] = [];
  const parity = computed(() => s() % 2);
  const stop = effect(() => runs.push(parity()));
  s.set(3); s.set(5); s.set(6);
  assert.deepEqual(runs, [1, 0]);
  stop();
  // Custom comparator: compared by id; never called for the first value.
  const item = signal({ id: 1, n: 0 }), calls: number[][] = [];
  const byId = computed(() => item(), { equals: (a, b) => { calls.push([a.id, b.id]); return a.id === b.id; } });
  const seen: number[] = [];
  const stopItem = effect(() => seen.push(byId().n));
  item.set({ id: 1, n: 1 }); item.set({ id: 2, n: 2 });
  assert.deepEqual(seen, [0, 2]); assert.deepEqual(calls, [[1, 1], [1, 2]]);
  stopItem();
  // equals: false notifies on every write, even an identical value.
  const always = signal(0, { equals: false }), hits: number[] = [];
  const stopAlways = effect(() => hits.push(always()));
  always.set(0); always.set(0);
  assert.deepEqual(hits, [0, 0, 0]);
  stopAlways();
  // Signal comparator skips equal writes.
  const point = signal({ x: 1 }, { equals: (a, b) => a.x === b.x }), xs: number[] = [];
  const stopPoint = effect(() => xs.push(point().x));
  point.set({ x: 1 }); point.set({ x: 2 });
  assert.deepEqual(xs, [1, 2]);
  stopPoint();
});
test('CHECK-only consumers skip runs when upstream computeds settle equal, through chains', () => {
  const s = signal(0); let middle = 0, runs = 0;
  const floor = computed(() => Math.floor(s() / 10));
  const label = computed(() => { middle++; return 'bucket ' + floor(); });
  const stop = effect(() => { label(); runs++; });
  for (let i = 1; i < 10; i++) s.set(i);
  assert.equal(runs, 1); assert.equal(middle, 1);
  s.set(10); assert.equal(runs, 2); assert.equal(middle, 2);
  stop();
});
