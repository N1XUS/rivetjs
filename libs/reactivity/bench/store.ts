// Store microbench: rivet path-signal store vs @solidjs/signals proxy store (Solid 2 RC). Run with
//   node --expose-gc libs/reactivity/bench/store.ts [--samples 5] [--json]
// 1,000 rows `{ id, label, done }`, one effect per row reading `done` (+ one reading the label of row 0).
import * as rivet from "@rivetjs/reactivity";
import * as store from "@rivetjs/reactivity/store";
import * as solid from "@solidjs/signals";

interface Row {
  id: number;
  label: string;
  done: boolean;
}
interface State {
  rows: Row[];
}
const ROWS = 1000;
const rows = (): Row[] => Array.from({ length: ROWS }, (_, i) => ({ id: i, label: "row " + i, done: false }));

interface Subject {
  /** Create the store and the effects (one per row). */
  setup(): void;
  /** Toggle one row's `done`. */
  one(i: number): void;
  /** Toggle every row's `done` in one batch. */
  all(value: boolean): void;
  dispose(): void;
  runs(): number;
}

const subjects: Record<string, () => Subject> = {
  rivet: () => {
    let s: store.Store<State>, dispose = () => {}, runs = 0;
    return {
      setup() {
        s = store.createStore<State>({ rows: rows() });
        dispose = rivet.createRoot((stop) => {
          for (let i = 0; i < ROWS; i++) rivet.effect(() => void (store.read(s, `rows.${i}.done` as "rows.0.done"), runs++));
          rivet.effect(() => void store.read(s, "rows.0.label"));
          return stop;
        }).value;
      },
      one: (i) => store.write(s, `rows.${i}.done` as "rows.0.done", (done) => !done),
      all: (value) => store.write(s, "rows", (list) => list.map((row) => (row.done === value ? row : { ...row, done: value }))),
      dispose: () => dispose(),
      runs: () => runs,
    };
  },
  solid: () => {
    let get: solid.Store<State>, set: solid.StoreSetter<State>, dispose = () => {}, runs = 0;
    return {
      setup() {
        [get, set] = solid.createStore<State>({ rows: rows() });
        dispose = solid.createRoot((stop) => {
          for (let i = 0; i < ROWS; i++) solid.createRenderEffect(() => get.rows[i]!.done, () => void runs++);
          solid.createRenderEffect(() => get.rows[0]!.label, () => {});
          return stop;
        });
        solid.flush();
      },
      one: (i) => {
        set((draft) => void (draft.rows[i]!.done = !draft.rows[i]!.done));
        solid.flush();
      },
      all: (value) => {
        set((draft) => {
          for (const row of draft.rows) row.done = value;
        });
        solid.flush();
      },
      dispose: () => dispose(),
      runs: () => runs,
    };
  },
};

const args = process.argv.slice(2);
const samples = Number(args[args.indexOf("--samples") + 1] || 5) || 5;
const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;
const gc = (globalThis as { gc?: () => void }).gc;
const out: Record<string, Record<string, number>> = {};
for (const [name, make] of Object.entries(subjects)) {
  const times: Record<string, number[]> = { setup: [], one: [], all: [] };
  let runs = 0;
  for (let sample = 0; sample < samples + 1; sample++) {
    const subject = make();
    gc?.();
    let t = performance.now();
    subject.setup();
    const setup = performance.now() - t;
    t = performance.now();
    for (let i = 0; i < ROWS; i++) subject.one(i);
    const one = performance.now() - t;
    t = performance.now();
    for (let k = 0; k < 20; k++) subject.all(k % 2 === 0);
    const all = performance.now() - t;
    runs = subject.runs();
    subject.dispose();
    // First sample warms up.
    if (sample === 0) continue;
    times.setup!.push(setup);
    times.one!.push(one);
    times.all!.push(all);
  }
  out[name] = { setupMs: +median(times.setup!).toFixed(3), oneByOneMs: +median(times.one!).toFixed(3), allTwentyMs: +median(times.all!).toFixed(3), effectRuns: runs };
}
if (args.includes("--json")) console.log(JSON.stringify(out));
else console.table(out);
