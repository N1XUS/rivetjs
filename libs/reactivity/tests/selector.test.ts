import { test } from "vitest";
import assert from "node:assert/strict";
import { queryObjects } from "node:v8";
import { selector, signal, computed, effect, batch, createRoot, untrack, getOwner, memberKeys, _trackReads } from "../index.ts";
import { _debug } from "../debug.ts";

// Keyed selector: per-key readers re-run only when their key's result changes.
test("selector notifies only the previous and next key (default equality)", () => {
  const selected = signal<number | null>(1);
  const runs = [0, 0, 0, 0];
  const values: boolean[] = [];
  const root = createRoot((dispose) => {
    const isSelected = selector(selected);
    for (let k = 0; k < 4; k++)
      effect(() => {
        runs[k]++;
        values[k] = isSelected(k);
      });
    return dispose;
  });
  assert.deepEqual(runs, [1, 1, 1, 1]);
  assert.deepEqual(values, [false, true, false, false]);
  selected.set(3);
  assert.deepEqual(runs, [1, 2, 1, 2]);
  assert.deepEqual(values, [false, false, false, true]);
  selected.set(3);
  assert.deepEqual(runs, [1, 2, 1, 2]);
  selected.set(null);
  assert.deepEqual(runs, [1, 2, 1, 3]);
  assert.deepEqual(values, [false, false, false, false]);
  root.value();
  selected.set(0);
  assert.deepEqual(runs, [1, 2, 1, 3], "readers disposed with their root");
});

test("selector with a custom fn and a keys hint compares only the hinted keys", () => {
  const keys = signal<Set<string>>(new Set(["a"]));
  const compared: string[] = [];
  const has = selector(
    keys,
    (key: string, set: Set<string>) => {
      compared.push(key);
      return set.has(key);
    },
    {
      keys: (next, previous) => {
        const changed: string[] = [];
        for (const k of next) if (!previous.has(k)) changed.push(k);
        for (const k of previous) if (!next.has(k)) changed.push(k);
        return changed;
      },
    },
  );
  const runs: Record<string, number> = {};
  createRoot(() => {
    for (const k of ["a", "b", "c", "d"])
      effect(() => {
        runs[k] = (runs[k] ?? 0) + 1;
        has(k);
      });
  });
  compared.length = 0;
  keys.set(new Set(["b"]));
  assert.deepEqual(runs, { a: 2, b: 2, c: 1, d: 1 });
  // Only the hinted keys (a, b) are compared by the watcher (twice each: next + previous), then re-read.
  assert.deepEqual(compared.slice(0, 4).sort(), ["a", "a", "b", "b"]);
  assert.equal(compared.includes("c"), false);
});

test("untracked reads and computeds see the current value", () => {
  const selected = signal(1);
  const isSelected = selector(selected);
  assert.equal(isSelected(1), true);
  selected.set(2);
  assert.equal(isSelected(1), false);
  assert.equal(
    untrack(() => isSelected(2)),
    true,
  );
  createRoot(() => {
    const two = computed(() => isSelected(2));
    const three = computed(() => isSelected(3));
    assert.equal(two(), true);
    assert.equal(three(), false);
    selected.set(3);
    assert.equal(two(), false);
    assert.equal(three(), true);
  });
});

test("a reader evaluated inside a batch before the flush sees the new value", () => {
  const selected = signal(1);
  const seen: boolean[] = [];
  createRoot(() => {
    const isSelected = selector(selected);
    effect(() => void seen.push(isSelected(2)));
    batch(() => {
      selected.set(2);
      // A computed created and read mid-batch catches the watcher up first.
      assert.equal(computed(() => isSelected(2))(), true);
      assert.deepEqual(seen, [false]);
    });
    assert.deepEqual(seen, [false, true]);
  });
});

test("a _trackReads collector records the source signal, not the per-key sources", () => {
  const selected = signal(1);
  const isSelected = selector(selected);
  const { value, signals } = _trackReads(() => isSelected(1));
  assert.equal(value, true);
  assert.deepEqual(signals, [selected]);
});

test("a computed source works and unobserved keys are swept", () => {
  const n = signal(0);
  const parity = computed(() => n() % 2);
  const runs = [0, 0];
  createRoot((dispose) => {
    const is = selector(parity);
    for (let k = 0; k < 2; k++) effect(() => void (runs[k]++, is(k)));
    n.set(2);
    assert.deepEqual(runs, [1, 1], "equal computed value: no key notified");
    n.set(3);
    assert.deepEqual(runs, [2, 2]);
    // Many short-lived readers: entries of disposed readers are swept as new keys arrive.
    for (let k = 10; k < 400; k++) createRoot((d) => (effect(() => void is(k)), d)).dispose();
    dispose();
  });
});

test("the watcher unsubscribes from the source once no reader is left", () => {
  const selected = signal(0);
  const is = selector(selected);
  const observers = () => _debug(selected)!.observers().length;
  const root = createRoot((dispose) => {
    for (let k = 0; k < 3; k++) effect(() => void is(k));
    return dispose;
  });
  assert.equal(observers(), 1, "one watcher, not one observer per reader");
  root.value();
  for (let i = 1; i <= 16 && observers() > 0; i++) selected.set(i);
  assert.equal(observers(), 0);
  // A new reader re-creates it.
  let seen = false;
  createRoot(() => effect(() => void (seen = is(20))));
  assert.equal(seen, false);
  selected.set(20);
  assert.equal(seen, true);
});

test("a _trackReads collector sees through a computed that read a selector key", () => {
  const selected = signal(1);
  const is = selector(selected);
  createRoot(() => {
    const one = computed(() => is(1));
    // Evaluated first by an effect (keyed path), then read by a collector.
    effect(() => void one());
    const { value, signals } = _trackReads(() => one());
    assert.equal(value, true);
    assert.deepEqual(signals, [selected]);
  });
});

test("readers of one key subscribed before and after the first change are all notified; re-runs keep their source", () => {
  const selected = signal<number | null>(null);
  const is = selector(selected);
  const runs = [0, 0, 0, 0];
  const root = createRoot((dispose) => {
    // Two readers of key 1 and one of key 2 subscribe before any change (pending, not indexed yet).
    effect(() => void (runs[0]++, is(1)));
    effect(() => void (runs[1]++, is(1)));
    effect(() => void (runs[2]++, is(2)));
    return dispose;
  });
  selected.set(1);
  assert.deepEqual(runs, [2, 2, 1, 0]);
  // A reader of key 1 added after the index exists shares it; a reader re-run reads the same key again.
  const late = createRoot((dispose) => (effect(() => void (runs[3]++, is(1))), dispose));
  selected.set(2);
  assert.deepEqual(runs, [3, 3, 2, 2]);
  selected.set(1);
  assert.deepEqual(runs, [4, 4, 3, 3]);
  late.value();
  selected.set(null);
  assert.deepEqual(runs, [5, 5, 3, 3], "a disposed reader leaves its key's chain");
  root.value();
  selected.set(1);
  assert.deepEqual(runs, [5, 5, 3, 3]);
});

test("a NaN key matches itself (SameValueZero, as the index map)", () => {
  const selected = signal(0);
  const is = selector(selected, (key, value) => Object.is(key, value), { keys: (next, previous) => [next, previous] });
  let runs = 0;
  createRoot(() => effect(() => void (runs++, is(Number.NaN))));
  selected.set(Number.NaN);
  assert.equal(runs, 2);
  selected.set(1);
  assert.equal(runs, 3);
});

test("short-lived readers before any change do not grow the pending list without bound", () => {
  const selected = signal(0);
  const is = selector(selected);
  const keep = createRoot((dispose) => (effect(() => void is(-1)), dispose));
  for (let k = 0; k < 5000; k++) createRoot((d) => (effect(() => void is(k)), d)).dispose();
  let seen = false;
  createRoot(() => effect(() => void (seen = is(4999))));
  selected.set(4999);
  assert.equal(seen, true);
  keep.value();
});

test("after the idle fold, indexed and newly pending readers (several per key, not adjacent) are notified", async () => {
  const selected = signal<number | null>(null);
  const is = selector(selected);
  const runs = [0, 0, 0, 0];
  const roots = [1, 2, 1].map((key, i) => createRoot((dispose) => (effect(() => void (runs[i]++, is(key))), dispose)));
  await new Promise((resolve) => setTimeout(resolve, 5)); // the fold indexes keys 1 (two readers, chained) and 2
  const late = createRoot((dispose) => (effect(() => void (runs[3]++, is(2))), dispose)); // indexed key: shares its head
  selected.set(1);
  assert.deepEqual(runs, [2, 1, 2, 1]);
  selected.set(2);
  assert.deepEqual(runs, [3, 2, 3, 2]);
  roots[0]!.value();
  late.value();
  selected.set(1);
  assert.deepEqual(runs, [3, 3, 4, 2]);
  roots[1]!.value();
  roots[2]!.value();
  selected.set(2);
  assert.deepEqual(runs, [3, 3, 4, 2]);
});

// Live key sources of every selector in the process (full GC first). The constructor comes from a reader's
// debug view (`ref` of a key source is the source itself).
const keySources = (() => {
  let ctor: (new (...args: never[]) => object) | null = null;
  return (is?: (key: number) => boolean): number => {
    if (ctor === null) {
      createRoot((dispose) => {
        effect(() => {
          is!(-100);
          ctor = (_debug(getOwner())!.sources()[0]!.ref as { constructor: new (...args: never[]) => object }).constructor;
        });
        dispose();
      });
    }
    return queryObjects(ctor!, { format: "count" }) as number;
  };
})();
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

test("run / clear cycles without a selection change keep the key index bounded", async () => {
  const selected = signal<number | null>(null);
  const is = selector(selected);
  let kept = 0;
  const keep = createRoot((dispose) => (effect(() => void (kept++, is(0))), dispose));
  const before = keySources(is);
  let id = 1;
  for (let cycle = 0; cycle < 5; cycle++) {
    const rows = createRoot((dispose) => {
      for (let i = 0; i < 200; i++) {
        const key = id++;
        effect(() => void is(key));
      }
      return dispose;
    });
    await tick(); // the fold indexes the 200 keys
    rows.value(); // clear: every row reader leaves
    await tick(); // the next fold prunes them
  }
  assert.ok(keySources() - before <= 1, `key sources of removed readers are released (${keySources() - before} left)`);
  // The surviving reader and new readers are still notified.
  let fresh = 0;
  createRoot(() => effect(() => void (fresh++, is(id))));
  selected.set(0);
  selected.set(id);
  assert.equal(kept, 3);
  assert.equal(fresh, 2);
  keep.value();
});

test("a key read by several readers is dropped once the last one leaves", async () => {
  const selected = signal<number | null>(null);
  const is = selector(selected);
  const observers = () => _debug(selected)!.observers().length;
  const runs = [0, 0];
  // Two readers in a row share key 1's source (`last`): its observers are an array.
  const roots = [0, 1].map((i) => createRoot((dispose) => (effect(() => void (runs[i]++, is(1))), dispose)));
  const before = keySources(is);
  await tick();
  roots[0]!.value();
  await tick();
  selected.set(1);
  assert.deepEqual(runs, [1, 2], "the remaining reader of the key is notified");
  roots[1]!.value();
  await tick();
  assert.ok(before - keySources() >= 1, "the emptied key source left the index");
  assert.equal(observers(), 0, "no key observed: the fold disposed the watcher");
  // A new reader re-creates the watcher.
  let seen = false;
  createRoot(() => effect(() => void (seen = is(2))));
  selected.set(2);
  assert.equal(seen, true);
});

// LAZY-T6 keyed wake: `_trackReads(fn, arg, keyed)` reports selector reads whose wake can be the key's own.
test("memberKeys: the keys in exactly one of two Sets; null unless both are Sets", () => {
  assert.deepEqual(memberKeys(new Set([1, 2]), new Set([2, 3])), [1, 3]);
  assert.deepEqual(memberKeys(new Set(), new Set()), []);
  assert.equal(memberKeys("all", new Set([1])), null);
  assert.equal(memberKeys(new Set([1]), null), null);
});

test("a _trackReads keyed hook takes selector(signal) reads of known hints (default pair, memberKeys) instead of the signal", () => {
  const focused = signal<number | null>(1);
  const selection = signal<Set<number> | "all">(new Set([2]));
  const isFocused = selector(focused);
  const isSelected = selector(selection, (key: number, value) => value === "all" || value.has(key), { keys: memberKeys });
  const custom = selector(selection, (key: number, value) => value === "all" || value.has(key), { keys: () => null });
  const derived = selector(() => focused());
  const plain = signal(0);
  const seen: [unknown, number, unknown][] = [];
  const hook = (source: unknown, kind: 0 | 1, key: unknown) => (seen.push([source, kind, key]), true);
  const { value, signals } = _trackReads(() => [isFocused(1), isSelected(2), isSelected(3), plain()], undefined, hook);
  assert.deepEqual(value, [true, true, false, 0]);
  assert.deepEqual(seen, [
    [focused, 0, 1],
    [selection, 1, 2],
    [selection, 1, 3],
  ]);
  assert.deepEqual(signals, [plain]);
  // Unknown hint / non-signal source: the signal is the read (the hook is not asked).
  seen.length = 0;
  const other = _trackReads(() => [custom(2), derived(1)], undefined, hook);
  assert.deepEqual(other.value, [true, true]);
  assert.deepEqual(seen, []);
  assert.deepEqual(other.signals, [selection, focused]);
  // The hook declines (false): the read is the signal's, as without a hook.
  const declined = _trackReads(
    () => isSelected(2),
    undefined,
    () => false,
  );
  assert.deepEqual(declined.signals, [selection]);
  // Without a hook: unchanged (the source signal).
  assert.deepEqual(_trackReads(() => isSelected(2)).signals, [selection]);
});

test("a _trackReads keyed hook sees a keyed read through a computed (its key source)", () => {
  const selection = signal<Set<number> | "all">(new Set([1]));
  const isSelected = selector(selection, (key: number, value) => value === "all" || value.has(key), { keys: memberKeys });
  createRoot((dispose) => {
    const one = computed(() => isSelected(1));
    const seen: unknown[] = [];
    const { value, signals } = _trackReads(
      () => one(),
      undefined,
      (source, kind, key) => (seen.push(source, kind, key), true),
    );
    assert.equal(value, true);
    assert.deepEqual(seen, [selection, 1, 1]);
    assert.deepEqual(signals, []);
    dispose();
  });
});
