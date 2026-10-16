// Reactivity microbench: rivet vs @solidjs/signals (Solid 2 RC). Run with
//   node --expose-gc libs/reactivity/bench/bench.ts [--only rivet|solid] [--json]
// Each case builds its graph once per sample, times the measured phase, and reports the median.
import * as rivet from "@rivetjs/reactivity";
import * as solid from "@solidjs/signals";

/** Minimal common surface over both libraries; each case only uses this. */
interface Adapter {
  signal<T>(v: T): readonly [() => T, (v: T) => unknown];
  computed<T>(fn: () => T): () => T;
  effect(fn: () => unknown): void;
  root(fn: () => void): () => void;
  batch(fn: () => void): void;
  flush(): void;
}
type Result = Record<string, number>;
interface Case {
  run(): void;
  after?: () => void;
  extra?: () => Result;
}

const adapters: Record<string, Adapter> = {
  rivet: {
    signal: <T>(v: T) => {
      const get = rivet.signal(v);
      return [get, (v: T) => get.set(v)];
    },
    computed: <T>(fn: () => T) => rivet.computed(fn),
    effect: (fn) => void rivet.effect(fn),
    root: (fn) => rivet.createRoot((dispose) => (fn(), dispose)).value,
    batch: (fn) => rivet.batch(fn),
    flush: () => {},
  },
  solid: {
    signal: <T>(v: T) => solid.createSignal(v as Exclude<T, Function>), // bench values are never functions
    computed: <T>(fn: () => T) => solid.createMemo(fn),
    effect: (fn) => solid.createRenderEffect(fn, () => {}),
    root: (fn) => solid.createRoot((dispose) => (fn(), dispose)),
    // Solid batches writes until flush().
    batch: (fn) => {
      fn();
      solid.flush();
    },
    flush: () => solid.flush(),
  },
};

const cases: Record<string, (r: Adapter) => Case> = {
  // Build 10k signal → computed → effect triples, then dispose.
  create: (r) => {
    let dispose: () => void;
    return {
      run: () => {
        dispose = r.root(() => {
          for (let i = 0; i < 10000; i++) {
            const [get] = r.signal(i);
            const double = r.computed(() => get() * 2);
            r.effect(() => double());
          }
        });
        r.flush();
      },
      after: () => dispose(),
    };
  },
  // One signal, 1,000 effects; 100 writes.
  fanout: (r) => {
    let set: (v: number) => unknown;
    const dispose = r.root(() => {
      const [get, write] = r.signal(0);
      set = write;
      for (let i = 0; i < 1000; i++) r.effect(() => get());
    });
    r.flush();
    let n = 0;
    return { run: () => { for (let i = 0; i < 100; i++) (set(++n), r.flush()); }, after: dispose };
  },
  // Signal → 1,000-deep computed chain → effect; 100 writes.
  chain: (r) => {
    let set: (v: number) => unknown;
    const dispose = r.root(() => {
      const [get, write] = r.signal(0);
      set = write;
      let last = get;
      for (let i = 0; i < 1000; i++) {
        const prev = last;
        last = r.computed(() => prev() + 1);
      }
      r.effect(() => last());
    });
    r.flush();
    let n = 0;
    return { run: () => { for (let i = 0; i < 100; i++) (set(++n), r.flush()); }, after: dispose };
  },
  // Signal → 4 computeds → sum computed → effect; 10k writes.
  diamond: (r) => {
    let set: (v: number) => unknown;
    const dispose = r.root(() => {
      const [get, write] = r.signal(0);
      set = write;
      const parts = [1, 2, 3, 4].map((k) => r.computed(() => get() * k));
      const sum = r.computed(() => parts.reduce((t, p) => t + p(), 0));
      r.effect(() => sum());
    });
    r.flush();
    let n = 0;
    return { run: () => { for (let i = 0; i < 10000; i++) (set(++n), r.flush()); }, after: dispose };
  },
  // 1,000 signals with one effect each, all written in one batch; 100 batches.
  batched: (r) => {
    const sets: ((v: number) => unknown)[] = [];
    const dispose = r.root(() => {
      for (let i = 0; i < 1000; i++) {
        const [get, set] = r.signal(0);
        sets.push(set);
        r.effect(() => get());
      }
    });
    r.flush();
    let n = 0;
    return { run: () => { for (let i = 0; i < 100; i++) { n++; r.batch(() => { for (const set of sets) set(n); }); } }, after: dispose };
  },
  // For-row churn: 10k roots of 1 signal + 2 computeds + 3 effects, created and disposed.
  churn: (r) => ({
    run: () => {
      for (let i = 0; i < 10000; i++) {
        const dispose = r.root(() => {
          const [get] = r.signal(i);
          const a = r.computed(() => get() + 1), b = r.computed(() => get() * 2);
          r.effect(() => a());
          r.effect(() => b());
          r.effect(() => get());
        });
        r.flush();
        dispose();
      }
    },
  }),
  // Effect switching between two sources; 10k writes.
  dynamic: (r) => {
    let setCond: (v: boolean) => unknown, setA: (v: number) => unknown;
    const dispose = r.root(() => {
      const [cond, c] = r.signal(true), [a, sa] = r.signal(0), [b] = r.signal(0);
      setCond = c;
      setA = sa;
      r.effect(() => (cond() ? a() : b()));
    });
    r.flush();
    let n = 0;
    return { run: () => { for (let i = 0; i < 10000; i++) (setCond(i % 2 === 0), setA(++n), r.flush()); }, after: dispose };
  },
  // Computed that mostly recomputes to the same value; 10k writes. Reports effect runs.
  cutoff: (r) => {
    let set: (v: number) => unknown, runs = 0;
    const dispose = r.root(() => {
      const [get, write] = r.signal(0);
      set = write;
      const bucket = r.computed(() => Math.floor(get() / 100));
      r.effect(() => (bucket(), runs++));
    });
    r.flush();
    let n = 0;
    return { run: () => { runs = 0; for (let i = 0; i < 10000; i++) (set(++n), r.flush()); }, after: dispose, extra: () => ({ effectRuns: runs }) };
  },
};

const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[xs.length >> 1];
const gc = (): void => void globalThis.gc?.();

function time(adapter: Adapter, name: string, samples = 15): Result {
  const out: number[] = [];
  let extra: Result | undefined;
  for (let s = 0; s < samples + 3; s++) {
    const c = cases[name]!(adapter);
    gc();
    const t = performance.now();
    c.run();
    const dt = performance.now() - t;
    extra = c.extra?.();
    c.after?.();
    if (s >= 3) out.push(dt);
  }
  return { ms: +median(out).toFixed(3), ...extra };
}

// Retained heap per signal / effect, from 100k live instances.
function heap(adapter: Adapter): Result {
  const measure = (build: () => { list?: unknown[]; dispose?: () => void }) => {
    gc(); gc();
    const before = process.memoryUsage().heapUsed;
    const keep = build();
    gc(); gc();
    const bytes = (process.memoryUsage().heapUsed - before) / 100000;
    keep.dispose?.();
    return Math.round(bytes);
  };
  const signals = measure(() => {
    const list: unknown[] = [];
    for (let i = 0; i < 100000; i++) list.push(adapter.signal(i));
    return { list };
  });
  const effects = measure(() => {
    let get: () => number;
    const dispose = adapter.root(() => {
      [get] = adapter.signal(0);
      for (let i = 0; i < 100000; i++) adapter.effect(() => get());
    });
    adapter.flush();
    return { dispose };
  });
  return { bytesPerSignal: signals, bytesPerEffect: effects };
}

const args = process.argv.slice(2);
const only = args.includes("--only") ? [args[args.indexOf("--only") + 1]] : Object.keys(adapters);
if (!globalThis.gc) console.warn("run with --expose-gc for stable numbers and heap figures");
const results: Record<string, Record<string, Result>> = {};
for (const lib of only) {
  const adapter = adapters[lib]!, row: Record<string, Result> = (results[lib] = {});
  for (const name of Object.keys(cases)) row[name] = time(adapter, name);
  if (globalThis.gc) row.heap = heap(adapter);
}
if (args.includes("--json")) console.log(JSON.stringify(results, null, 2));
else {
  const libs = Object.keys(results);
  console.log("| case | " + libs.join(" | ") + " |\n|---|" + libs.map(() => "---").join("|") + "|");
  for (const name of [...Object.keys(cases), "heap"]) {
    const cell = (lib: string) => {
      const v = results[lib]![name];
      return v ? Object.entries(v).map(([k, x]) => (k === "ms" ? x + " ms" : k + " " + x)).join(", ") : "–";
    };
    console.log("| " + name + " | " + libs.map(cell).join(" | ") + " |");
  }
}
