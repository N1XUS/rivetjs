// Repeated entries (wire only, lane RESUME-STATE-DIET): collections record the same handlers / bindings / recipes / props
// objects per element. Handler maps and plain bindings repeat the previous element's relocated (`RepeatedHandlers` /
// `RepeatedBinding`), table recipes and `o` objects as `{R}` (`EntryRecord.R`); the inline repeat add-on
// `resume-repeat.ts` decodes all three before anything reads the state (the table decoder never sees `R`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { createDecoder, handlersOf, relocate } from "@rivetjs/runtime/resume-format";
import type { BindingEntry, LoaderDocument, ResumeState, TableEntry } from "@rivetjs/runtime/resume-format";
import { EXPAND, REPEAT } from "../resume-loader.min.ts";
import { repeat } from "../resume-repeat.ts";
import { compileResume, importServer } from "./resume/compile.ts";

const source = `import { computed, signal } from "@rivetjs/reactivity";
function Row(props: { label: string; n: number }) {
  const count = signal(props.n);
  const double = computed(() => count() * 2);
  const item = { label: props.label, count, double };
  const items: unknown[] = [];
  return (
    <li>
      <button title={item.label + count()} onClick={() => count.set(count() + 1)} onKeyDown={() => items.push(item)}>
        {double()}
      </button>
    </li>
  );
}
export function Page(props: { rows: number }) {
  return <ul>{Array.from({ length: props.rows }, (_, i) => <Row label={"L" + i} n={i} />)}</ul>;
}`;
const dom = compileResume(source, "dom", "src/rows.tsx");
const server = await importServer<{ Page(props: { rows: number }): never }>(compileResume(source, "server", "src/rows.tsx").code);
const manifest: ResumeManifest = { runtime: "/rt.js", symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c.js"])) };
const render = async (rows: number): Promise<{ html: string; state: ResumeState }> => {
  const html = await resumableToString(() => server.Page({ rows }), { manifest });
  return { html, state: JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)![1]!) as ResumeState };
};
// The repeat add-on as the page runs it (its own `document`).
const decodeState = (state: ResumeState): ResumeState => {
  const d = {} as LoaderDocument;
  new Function("document", REPEAT)(d);
  d.$rx!(state, state.b);
  return state;
};
const isHandlers = (value: unknown): boolean => value !== null && typeof value === "object" && !Array.isArray(value);

test("repeat add-on: generated, inline-safe, fits 500 B brotli", async () => {
  const { brotliCompressSync } = await import("node:zlib");
  const { minifiedRepeat } = await import("../build-loader.ts");
  assert.equal(REPEAT, await minifiedRepeat(), "stale resume-loader.min.ts: run node libs/runtime/build-loader.ts");
  assert.doesNotMatch(REPEAT, /<\/script|<!--/i);
  const size = brotliCompressSync(REPEAT).length;
  assert.ok(size <= 500, `minified ${size} B`);
  // Self-contained: runs with a bare document.
  assert.doesNotThrow(() => new Function("document", "(" + repeat + ")()")({}));
});

test("small pages: no repeats, no add-on (it would cost more than it saves)", async () => {
  const { html, state } = await render(2);
  assert.ok(!html.includes(REPEAT));
  assert.ok(Object.values(state.e).every(isHandlers));
  assert.ok(state.b.every((entry) => entry[0] >= -1));
});

test("collections: handler maps and bindings repeat the previous row; the add-on decodes them before the state is read", async () => {
  const rows = 60;
  const { html, state } = await render(rows);
  // The add-on goes before the state script (the loader decodes with it when parsing).
  const at = html.indexOf(REPEAT);
  assert.ok(at >= 0 && at < html.indexOf('type="rivet/state"'));
  const ids = Object.keys(state.e);
  assert.equal(ids.length, rows);
  const repeated = ids.filter((id) => Array.isArray(state.e[id]));
  assert.ok(repeated.length >= rows - 2, JSON.stringify(state.e));
  const packed = state.b.filter((entry) => entry[0] < -1);
  assert.ok(packed.length >= rows - 2, JSON.stringify(state.b));
  // Raw readers: `handlersOf` decodes a repeated map like the add-on.
  const raw = Object.fromEntries(ids.map((id) => [id, handlersOf(state.e, id)]));
  const decoded = decodeState(state);
  assert.deepEqual(decoded.e, raw);
  assert.ok(Object.values(decoded.e).every(isHandlers));
  assert.ok(decoded.b.every((entry) => entry[0] >= 0 && Array.isArray(entry[3]) && entry.length === 7));
  // Each row's handlers / bindings capture its own values: row k's count signal holds k.
  const signals: number[] = [];
  const decoder = createDecoder(decoded.t, {
    signal: (index) => {
      const s = Object.assign(() => undefined, { set: (value: unknown) => void signals.push(index, value as number) });
      return s as never;
    },
    fn: () => () => {},
    computed: () => () => {},
  });
  const counts = new Map<number, number>();
  const read = (ref: number): void => {
    decoder.get(ref);
    for (let i = 0; i < signals.length; i += 2) counts.set(signals[i]!, signals[i + 1]!);
  };
  const clicks = ids.map((id) => decoded.e[id]!.click!);
  assert.equal(new Set(clicks.map((h) => h[0])).size, 1);
  for (const h of clicks) for (const ref of h[1]) read(ref);
  const own = clicks.map((h) => h[1].map((ref) => counts.get(ref)).find((v) => v !== undefined));
  assert.deepEqual(
    own,
    Array.from({ length: rows }, (_, k) => k),
  );
  // Text bindings: one per row, each reading its row's signal.
  const texts = decoded.b.filter((entry: BindingEntry) => entry[1] === null);
  assert.equal(texts.length, rows);
  assert.deepEqual(
    texts.map((entry) => counts.get(entry[4][0]!)),
    Array.from({ length: rows }, (_, k) => k),
  );
});

test("table recipes / objects as {R}: each decodes to its own captures, like the full entry", async () => {
  const rows = 60;
  const { state } = await render(rows);
  const relocated = state.t.flatMap((entry, i) => (entry !== null && typeof entry === "object" && "R" in entry ? [i] : []));
  assert.ok(relocated.length >= rows - 3, JSON.stringify(state.t.slice(0, 80)));
  decodeState(state);
  assert.ok(!state.t.some((entry) => entry !== null && typeof entry === "object" && "R" in entry));
  const values = new Map<number, unknown>();
  const decoder = createDecoder(state.t, {
    signal: (index) => Object.assign(() => values.get(index), { set: (value: unknown) => void values.set(index, value) }) as never,
    computed: (symbol, captures) => ({ symbol, captures }),
  });
  // Every row's item object (`{label, count, double}`), from the first two (full / shaped) through the relocated ones.
  const items = Object.keys(state.e).map((id) => decoder.get(handlersOf(state.e, id)!.keydown![1][1]!) as Record<string, unknown>);
  assert.deepEqual(
    items.map((item) => [item.label, (item.count as () => number)(), ((item.double as { captures: unknown[] }).captures[0] as () => number)()]),
    Array.from({ length: rows }, (_, k) => ["L" + k, k, k]),
  );
});

test("relocation decoding: chains, objects, `{y}` bases; an undecoded relocation throws when read", () => {
  assert.equal(relocate(5, [10, 3]), 5);
  assert.equal(relocate(10, [10, 3]), 13);
  assert.equal(relocate(25, [10, 3, 20, -1]), 24);
  const calls: unknown[][] = [];
  const hooks = {
    fn: (symbol: unknown, captures: unknown[]) => (calls.push([symbol, ...captures]), () => {}),
    computed: (symbol: unknown, captures: unknown[], options: unknown) => (calls.push(["c", symbol, ...captures, typeof options]), () => {}),
  };
  // 0..2 values; 3 a recipe of [0, 1]; 4 its relocation (floor 4 - 3 = 1: refs ≥ 1 move by 1 → [0, 2]); 5 chains on 4.
  const t: TableEntry[] = [
    "a",
    "b",
    "c",
    { f: [7, 0, 1] } as never,
    { R: [1, -3, 1] },
    { R: [1, -4, 0] },
    { o: ["x", 0, "y", 1] },
    { R: [1, -6, 1] },
    { w: 6, o: [1, 0] },
    { R: [1, -8, 1] },
    // 10 a recipe of [11]; 12 its `{y}` repeat (refs > 10 move by 2 → [13]); 14 relocates 12 (floor 1, −2 → [11]).
    { f: [7, 11] } as never,
    "d",
    { y: 10 },
    "e",
    { R: [2, -13, -2] },
  ];
  const d = {} as LoaderDocument;
  new Function("document", REPEAT)(d);
  d.$rx!({ t, e: {} } as unknown as ResumeState, []);
  const decoder = createDecoder(t, hooks);
  decoder.get(5);
  decoder.get(4);
  assert.deepEqual(calls, [
    [7, "a", "c"],
    [7, "a", "c"],
  ]);
  assert.deepEqual(decoder.get(7), { x: "a", y: "c" });
  assert.deepEqual(decoder.get(9), { x: "c", y: "a" });
  decoder.get(12);
  decoder.get(14);
  assert.deepEqual(calls.slice(2), [
    [7, "e"],
    [7, "d"],
  ]);
  assert.throws(() => createDecoder([{ f: [7] }, { R: [1] }] as TableEntry[], hooks).get(1));
});

test("repeat add-on chains to an expand add-on installed before it (a page shipping expand later re-ships repeat)", () => {
  // Handlers of element 1 repeat element 0's (refs ≥ 5 move by 1); binding 1 repeats binding 0 (node / region + 2, refs
  // ≥ 5 + 1); binding 2 is a region with compact rows (ids 20, 22) and a row template: its rows expand afterwards.
  const make = (): ResumeState =>
    ({
      t: [0, 0, 0, 0, 0, 5, 6, "a", "b"],
      e: { "0": { click: [0, [1, 5], [0]] }, "1": [1, 5, 1] },
      b: [
        [10, null, 1, [5], [5], [0], 3],
        [-2, 2, 5, 1],
        [30, "#", 2, [], [], [0], -1, null, { i: 20, d: 2, r: [7, 8] }, { e: { "1": { click: [3, [-2, 1], [0]] } }, b: [[1, null, 4, [-2], [], [0]]] }],
      ],
    }) as unknown as ResumeState;
  const run = (order: string[]): ResumeState => {
    const d = {} as LoaderDocument;
    for (const name of order) new Function("document", name === "expand" ? EXPAND : REPEAT)(d);
    const state = make();
    d.$rx!(state, state.b);
    return state;
  };
  const a = run(["expand", "repeat"]),
    b = run(["repeat", "expand", "repeat"]);
  assert.deepEqual(a, b);
  assert.deepEqual(a.e["1"], { click: [0, [1, 6], [0]] });
  assert.deepEqual(a.b[1], [12, null, 1, [6], [6], [0], 5]);
  assert.deepEqual(Object.keys(a.e).sort(), ["0", "1", "21", "23"]);
  assert.equal(a.b.length, 5);
});
