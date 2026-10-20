// LAZY-ROWS T4 (spec docs/design/specs/2026-10-19-lazy-collection-rows-design.md §3.1 / §3.2 / §3.3, rulings R1–R5): with
// `RIVET_LAZY_ROWS=on` a `$lazy` For (compiler T2) renders its rows unrecorded and writes ONE lazy row region record
// (state `L`, `LazyRowsEntry`) instead of per-row records; rows keep their marker pairs and render under the id seed
// `_rowIdPrefix(forId, index)`; sites a row re-run cannot replay turn the whole For back to recorded rows (R3). Default
// (unset / `off`): today's output, byte for byte.
import { afterEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import { renderResumable, resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { _rClientEvent, _rEffect } from "@rivetjs/runtime/server-resume";
import { Async, Portal, clientOnly, renderToString } from "@rivetjs/runtime/server";
import { RESUME_VERSION } from "@rivetjs/runtime/resume-format";
import type { LazyRowsEntry, RegionLocals, ResumeState } from "@rivetjs/runtime/resume-format";
import { _inIdScope, _rowIdPrefix, withIdScope } from "@rivetjs/runtime/id";
import { DEV } from "#dev";
import { compileResume, importServer } from "./resume/compile.ts";
import { readable } from "./resume/wire.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Row = { id: number; label: string };
type Inner = (props: { n: number }) => unknown;

const source = `import { For, Provider } from "@rivetjs/runtime/dom";
import { createContext, signal, untrack, _regionState, useContext } from "@rivetjs/reactivity";
import { createId } from "@rivetjs/runtime/id";
import { resumableContext } from "@rivetjs/runtime/resume-format";
let Inner = () => null;
let Slotted = () => null;
export const setInner = (c) => void (Inner = c);
export const setSlotted = (c) => void (Slotted = c);
export const sel = signal(2);
function Wrap(p) {
  return <div class="wrap">{p.children}</div>;
}
export function Row(p) {
  return <li id={createId()} class={sel() === p.row().id ? "on" : "off"}>
    <button aria-describedby={createId()} onClick={() => sel.set(p.row().id)}>{p.row().label}</button>
    <Inner n={p.row().id} />
    <Wrap><Slotted n={p.row().id} /></Wrap>
  </li>;
}
export function List(p) {
  return <ul><For each={() => p.rows} by={(r) => r.id}>{(row) => <Row row={row} />}</For></ul>;
}
export function Indexed(p) {
  return <ol><For each={() => p.rows} by={(r) => p.prefix + r}>{(r, i) => <li onClick={() => sel.set(i())}>{i()}:{r()}</li>}</For></ol>;
}
export function Live() {
  const list = signal([{ id: 1, label: "x" }, { id: 2, label: "y" }]);
  return <section>
    <button onClick={() => list.set([...list(), { id: 3, label: "z" }])}>add</button>
    <ul><For each={list} by={(r) => r.id}>{(row) => <li onClick={() => sel.set(row().id)}>{row().label}</li>}</For></ul>
  </section>;
}
function Counter(p) {
  const v = _regionState(() => signal(p.n * 10));
  return <b>{v()}</b>;
}
const Theme = resumableContext(createContext("light", { id: "lazy-theme" }));
export function Provided(p) {
  return <Provider token={Theme} value="dark"><ul><For each={() => p.rows} by={(n) => n}>{(n) => <li onClick={() => sel.set(n())}>{useContext(Theme)}:{n()}</li>}</For></ul></Provider>;
}
// A read inside an untracked body (cdk components: component bodies run untracked): the site's own read still counts.
export function Quiet(p) {
  return <ul><For each={() => p.rows} by={(n) => n}>{(n) => <li onClick={() => sel.set(n())}>{untrack(() => <i class={sel() === n() ? "a" : "b"} />)}</li>}</For></ul>;
}
export function Stateful(p) {
  return <ul><For each={() => p.rows} by={(n) => n}>{(n) => <li>{n() % 2 ? <Counter n={n()} /> : "even"}</li>}</For></ul>;
}
`;
const dom = compileResume(source, "dom", "src/rows.tsx");
const server = compileResume(source, "server", "src/rows.tsx");
assert.match(server.code, /"\$lazy": \[0, "id"\]/);
assert.match(server.code, /"\$lazy": \[3\]/);
assert.match(server.code, /"\$lazy": \[0, ""\]/);
const mod = await importServer<{
  List(p: { rows: Row[] }): ServerValue;
  Indexed(p: { rows: string[]; prefix: string }): ServerValue;
  Live(): ServerValue;
  Stateful(p: { rows: number[] }): ServerValue;
  Provided(p: { rows: number[] }): ServerValue;
  Quiet(p: { rows: number[] }): ServerValue;
  Row(p: { row: () => Row }): ServerValue;
  setInner(c: Inner): void;
  setSlotted(c: Inner): void;
}>(server.code);
const EFFECT = "src/rows.tsx#Fx$e",
  LISTENER = "src/rows.tsx#Ce$e";
// A build with `resume: { lazyRows: true }` (its browser runtime materialises lazy rows: the server may write them).
const manifest: ResumeManifest = {
  runtime: "/rt.js",
  symbols: { ...Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])), [EFFECT]: "/c/fx.js", [LISTENER]: "/c/ce.js" },
  lazyRows: true,
};
const rows: Row[] = [
  { id: 1, label: "a" },
  { id: 2, label: "b<" },
  { id: 3, label: "c" },
];
const none: Inner = () => null;

afterEach(() => {
  delete process.env.RIVET_LAZY_ROWS;
  mod.setInner(none);
  mod.setSlotted(none);
});
const render = async (factory: () => ServerValue, mode?: "on" | "off"): Promise<string> => {
  if (mode) process.env.RIVET_LAZY_ROWS = mode;
  else delete process.env.RIVET_LAZY_ROWS;
  return (await resumableToString(() => withIdScope("rv", factory), { manifest })) as string;
};
const stateOf = (html: string): ResumeState => readable(JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)![1]!));
// The markup between the page's state-free row markers (row k = `<!--r…[-->…<!--]-->`, its id written or left to the stride).
const rowHtml = (html: string): string[] => [...html.matchAll(/<!--r\d*\[-->(.*?)<!--\]-->/gs)].map((m) => m[1]!);
const entry = (state: ResumeState, k = 0): LazyRowsEntry => state.L![k]!;
const table = (state: ResumeState, ref: number): unknown => state.t[ref];

test("default (unset) and RIVET_LAZY_ROWS=off: no lazy records, recorded rows, the same page", async () => {
  const unset = await render(() => mod.List({ rows }));
  const off = await render(() => mod.List({ rows }), "off");
  assert.equal(unset, off);
  const state = stateOf(unset);
  assert.equal(state.L, undefined);
  assert.equal(state.v, RESUME_VERSION);
  assert.match(unset, /<li id="rv\d+" class="off" data-r="\d+">/);
});

test("RIVET_LAZY_ROWS=on with a build that did not opt in (manifest without lazyRows): no lazy records, the off page (dev: one warning)", async () => {
  const off = await render(() => mod.List({ rows }), "off");
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    process.env.RIVET_LAZY_ROWS = "on";
    const { lazyRows: _, ...plain } = manifest;
    const page = (await resumableToString(() => withIdScope("rv", () => mod.List({ rows })), { manifest: plain })) as string;
    await resumableToString(() => withIdScope("rv", () => mod.List({ rows })), { manifest: plain });
    assert.equal(page, off);
    assert.equal(stateOf(page).L, undefined);
    const hints = warn.mock.calls.filter(([m]) => String(m).includes("RIVET_LAZY_ROWS=on is ignored"));
    // Dev: once per process (two renders, one warning); production: none.
    assert.equal(hints.length, DEV ? 1 : 0);
    if (DEV) assert.match(String(hints[0]![0]), /rivet\(\{ resume: \{ lazyRows: true \} \}\)/);
  } finally {
    warn.mockRestore();
  }
});

test("format: rivet/state carries v = RESUME_VERSION = 2", async () => {
  assert.equal(RESUME_VERSION, 2);
  assert.equal(stateOf(await render(() => mod.List({ rows }), "on")).v, 2);
});

test("lazy For: one L record (id, page-root region, row function, items, key path, chunks, reads, event types), no row entries", async () => {
  const html = await render(() => mod.List({ rows }), "on");
  const state = stateOf(html);
  assert.equal(state.L!.length, 1);
  const [forId, region, rowFn, items, by, flags, chunks, reads, rowState, types, providers] = entry(state);
  assert.equal(region, -1);
  assert.equal(by, "id");
  assert.equal(flags, 0);
  // No state (0: the slot only pads), the rows' event types (T5: an event of one materialises the row), no providers.
  assert.equal(rowState, 0);
  assert.equal(types, "click");
  assert.equal(providers, undefined);
  // The row function: its symbol (the row arrow), the dom target's `slot` symbol of the same id.
  const fn = table(state, rowFn) as { f: string; a: number[] };
  const rowSymbol = dom.symbols.find((s) => s.id === fn.f);
  assert.ok(rowSymbol, fn.f);
  assert.deepEqual(table(state, items), { j: rows });
  assert.deepEqual(chunks, [state.c.indexOf("/c/" + rowSymbol.component + ".js")]);
  // The rows read `sel` (module signal): it ships with the record, not as row bindings.
  assert.ok(Array.isArray(reads) && reads.length === 1);
  const read = table(state, (reads as number[])[0]!) as { s: number };
  assert.equal(state.t[read.s], 2);
  // Suppressed: no handler, binding or region entry for anything inside the rows; no `data-r` in the markup.
  assert.deepEqual(state.e, {});
  assert.deepEqual(state.b, []);
  assert.doesNotMatch(html, /data-r=/);
  // Row k: marker id forId + 1 + k (the writer leaves stride-continuing ids out), ids seeded per row.
  assert.match(html, new RegExp(`<!--r${forId + 1}\\[--><li id="rvr${forId}_0_0" class="off">`));
  assert.match(html, new RegExp(`<!--r${forId + 2}\\[--><li id="rvr${forId}_1_0" class="on">`));
  assert.equal(rowHtml(html).length, 3);
  assert.match(rowHtml(html)[1]!, new RegExp(`<button aria-describedby="rvr${forId}_1_1">b&lt;</button>`));
  // The page still resumes (rows hold click handlers: the type is listened for).
  assert.match(html, /data-events="click"/);
});

test("id seeding: a row re-run under _rowIdPrefix(forId, index) renders the server row byte for byte", async () => {
  const html = await render(() => mod.List({ rows }), "on");
  const [forId] = entry(stateOf(html));
  const server = rowHtml(html);
  for (let k = 0; k < rows.length; k++) {
    const again = await renderToString(() => _inIdScope({ prefix: _rowIdPrefix(forId, k), n: 0 }, () => mod.Row({ row: () => rows[k]! }) as never));
    assert.equal(server[k], again, "row " + k);
  }
});

test("index flag and a function `by`: flags 1 | 2, `by` as its recipe", async () => {
  const state = stateOf(await render(() => mod.Indexed({ rows: ["x", "y"], prefix: "k" }), "on"));
  const [, , , items, by, flags] = entry(state);
  assert.equal(flags, 3);
  assert.equal(typeof by, "number");
  assert.match((table(state, by as number) as { f: string }).f, /^src\/rows\.tsx#Indexed\$/);
  assert.deepEqual(table(state, items), { j: ["x", "y"] });
});

test("inside a region: the record names the region, which carries no rows ([8]) and stays a region of its own reads", async () => {
  const html = await render(() => mod.Live(), "on");
  const state = stateOf(html);
  const regions = state.b.filter((b) => b[1] === "#");
  assert.equal(regions.length, 1);
  const [, region, , items] = entry(state);
  assert.equal(region, regions[0]![0]);
  assert.equal(regions[0]![8], undefined);
  assert.deepEqual(table(state, items), {
    j: [
      { id: 1, label: "x" },
      { id: 2, label: "y" },
    ],
  });
  // The add button (outside the rows) is recorded; the row `li`s are not.
  assert.equal(Object.keys(state.e).length, 1);
});

test("per-row keyed state: only rows whose render created _regionState values ship them (flag 4)", async () => {
  const html = await render(() => mod.Stateful({ rows: [1, 2, 3] }), "on");
  const state = stateOf(html);
  const [, , , , by, flags, , , held] = entry(state);
  const rowState = held as (number | RegionLocals)[];
  assert.equal(by, "");
  assert.equal(flags & 4, 4);
  assert.equal(rowState!.length, 4);
  assert.deepEqual([rowState![0], rowState![2]], [0, 2]);
  const [first, third] = [rowState![1] as { l: number[] }, rowState![3] as { l: number[] }];
  // Each value: the row's own signal (`{s}` entry) holding its server value.
  assert.equal(state.t[(table(state, first.l[0]!) as { s: number }).s], 10);
  assert.equal(state.t[(table(state, third.l[0]!) as { s: number }).s], 30);
  assert.match(html, /<li>even<\/li>/);
});

test("rows without state ship none (no flag 4, state slot 0)", async () => {
  const [, , , , , flags, , , rowState] = entry(stateOf(await render(() => mod.List({ rows }), "on")));
  assert.equal(flags & 4, 0);
  assert.equal(rowState, 0);
});

// R6 (LAZY-ROWS T5): a client effect / clientEvent listener inside a row runs when the row materialises — no fallback.
for (const [name, inner] of [
  ["clientEffect", () => (_rEffect(EFFECT, []), null)],
  ["clientEvent", () => (_rClientEvent(LISTENER, [], "w", "resize"), null)],
] as [string, Inner][])
  test(`no fallback (${name}, R6): the rows stay lazy, nothing of the row's ${name} is recorded; every row is listed at [11] (materialised at idle), the page boots`, async () => {
    mod.setInner(inner);
    const html = await render(() => mod.List({ rows }), "on");
    const state = stateOf(html);
    assert.equal(state.L!.length, 1);
    assert.deepEqual(state.fx, []);
    assert.deepEqual(state.ce, []);
    assert.deepEqual(entry(state)[11], [...rows.keys()]);
    assert.match(html, /data-boot/);
  });

test("providers around the For: identified ones ship at [10] (re-provided around a materialised row)", async () => {
  const html = await render(() => mod.Provided({ rows: [1, 2] }), "on");
  const state = stateOf(html);
  const [, , , , , , , , , , providers] = entry(state);
  assert.ok(Array.isArray(providers), String(providers));
  assert.equal((providers as unknown[])[0], "lazy-theme");
  assert.equal(table(state, (providers as number[])[1]!), "dark");
});

test("reads of sites inside untracked bodies (component bodies) are the rows' reads", async () => {
  const state = stateOf(await render(() => mod.Quiet({ rows: [1, 2] }), "on"));
  const reads = entry(state)[7];
  assert.ok(Array.isArray(reads) && reads.length === 1, String(reads));
});

const reasons: [string, Inner, RegExp][] = [
  ["Portal", () => Portal({ children: null }), /a Portal/],
  ["clientOnly", clientOnly<{ n: number }>(() => ({ default: () => null })) as Inner, /a clientOnly component/],
  ["Async", () => Async({ load: () => 1, children: (v: number) => String(v) }), /an Async boundary/],
];
for (const [name, inner, why] of reasons)
  test(`fallback (${name}): the whole For records its rows as today (R3), dev warns naming the For`, async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      mod.setInner(inner);
      const off = await render(() => mod.List({ rows }), "off");
      const on = await render(() => mod.List({ rows }), "on");
      // Recorded rows, the same page as with lazy rows off (the discarded lazy pass left no trace: ids, markers, state).
      assert.equal(on, off);
      assert.equal(stateOf(on).L, undefined);
      assert.match(on, /data-r=/);
      const warned = warn.mock.calls.map((call) => String(call[0])).filter((m) => m.includes("records its rows instead of lazy rows"));
      if (DEV)
        assert.ok(
          warned.some((m) => /<For> r\d+ \(row src\/rows\.tsx#List\$\w+\)/.test(m) && why.test(m)),
          warned.join("\n"),
        );
      else assert.deepEqual(warned, []);
    } finally {
      warn.mockRestore();
    }
  });

test("slot content placed through {children} renders within its row: a reason there is a plain fallback", async () => {
  mod.setSlotted(() => Portal({ children: null }));
  const on = await render(() => mod.List({ rows }), "on");
  assert.equal(stateOf(on).L, undefined);
  assert.equal(on, await render(() => mod.List({ rows }), "off"));
});

test("a site only the writing of the row reaches (an accessor child, a slot inside it) is found before the decision", async () => {
  mod.setInner(() => () => (Portal({ children: null }), null));
  mod.setSlotted(() => () => () => (Portal({ children: null }), "x"));
  const on = await render(() => mod.List({ rows }), "on");
  assert.equal(stateOf(on).L, undefined);
  assert.equal(on, await render(() => mod.List({ rows }), "off"));
  mod.setInner(() => null);
  const slotOnly = await render(() => mod.List({ rows }), "on");
  assert.equal(stateOf(slotOnly).L, undefined);
  assert.equal(slotOnly, await render(() => mod.List({ rows }), "off"));
});

test("slot content (`<Wrap>{children}</Wrap>`): unrecorded and seeded with its row's id scope", async () => {
  const { createId } = await import("@rivetjs/runtime/id");
  mod.setSlotted(({ n }) => `<i>${n}:${createId()}</i>`);
  const html = await render(() => mod.List({ rows }), "on");
  const [forId] = entry(stateOf(html));
  // Row 1's slot: its third id (li, button, then the slot's).
  assert.match(rowHtml(html)[1]!, new RegExp(`&lt;i&gt;2:rvr${forId}_1_2&lt;/i&gt;`));
  assert.doesNotMatch(html, /data-r=/);
});

test("streaming: a lazy For inside a streamed segment writes its record in that segment's patch", async () => {
  const src = `import { For } from "@rivetjs/runtime/dom";
import { Async } from "@rivetjs/runtime/server";
import { signal } from "@rivetjs/reactivity";
export function Page(p) {
  const n = signal(0);
  return <main><h1 onClick={() => n.set(n() + 1)}>{n()}</h1>
    <section><Async load={() => globalThis.__rows()} fallback={() => <i>wait</i>}>{(v) =>
      <ul><For each={() => v} by={(r) => r.id}>{(row) => <li onClick={() => n.set(row().id)}>{row().label}</li>}</For></ul>}</Async></section></main>;
}`;
  const d = compileResume(src, "dom", "src/stream.tsx");
  const m = await importServer<{ Page(p: object): ServerValue }>(compileResume(src, "server", "src/stream.tsx").code);
  (globalThis as { __rows?: () => Promise<Row[]> }).__rows = () => new Promise((resolve) => setTimeout(() => resolve(rows), 5));
  const man: ResumeManifest = { runtime: "/rt.js", symbols: Object.fromEntries(d.symbols.map((s) => [s.id, "/c/s.js"])), lazyRows: true };
  process.env.RIVET_LAZY_ROWS = "on";
  const chunks: string[] = [];
  await renderResumable(
    () => m.Page({}),
    { write: (c) => void chunks.push(c) },
    {
      manifest: man,
      stream: {},
    },
  );
  const html = chunks.join("");
  const shell = JSON.parse(/<script type="rivet\/state" data-region="0"[^>]*>(.*?)<\/script>/s.exec(html)![1]!) as ResumeState;
  assert.equal(shell.L, undefined);
  const [, json] = /<script type="rivet\/state" data-patch="\d+">(.*?)<\/script>/s.exec(html)!;
  const patch = JSON.parse(json!) as ResumeState & { t0: number };
  assert.equal(patch.L!.length, 1);
  const [forId, , rowFn, items] = patch.L![0]!;
  // Its refs point into this patch's table segment (or earlier): the record arrives with (never after) its rows.
  for (const ref of [rowFn, items]) assert.ok(ref < patch.t0 + patch.t.length, String(ref));
  assert.ok(rowFn >= patch.t0);
  // The segment's rows: markers forId + 1 … inside the template that precedes the patch.
  const template = html.slice(html.indexOf("<template data-a"), html.indexOf("data-patch"));
  assert.match(template, new RegExp(`<!--r${forId + 1}\\[--><li>a</li><!--\\]-->`));
  assert.doesNotMatch(template, /data-r=/);
});
