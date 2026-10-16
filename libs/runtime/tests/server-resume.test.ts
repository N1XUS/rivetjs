import { readable } from "./resume/wire.ts";
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/server";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer } from "./resume/compile.ts";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";

/** Table entry objects (signal {s}, computed {c}, function {f, a}, ref {r}, ...). */
interface Entry {
  s?: number;
  c?: number;
  f?: string;
  a?: number[];
  q?: number | false;
  k?: string;
  r?: number;
}
type TableValue = Entry | string | number | boolean | null;
/** Handler: [symbol, captures, chunks, prefetch]. */
type Handler = [string, number[], number[], number[]?];
/** Compact For rows. */
interface Rows {
  d: number;
  r: number[];
  x?: unknown;
  i: number;
}
interface Template {
  e: Record<string, Record<string, Handler>>;
  b: [number, string | null, ...unknown[]][];
}
/** Binding: [node, name, _, reads, deps, _, region, _, rows, template]. */
type Binding = [number, string | null, unknown, number[], number[], unknown, unknown, unknown, (number[] | Rows)?, Template?];
interface State {
  h?: string;
  rt: string;
  c: string[];
  t: TableValue[];
  e: Record<string, Record<string, Handler>>;
  b: Binding[];
  m: Record<string, [string, number, number[]]>;
  fx: [string, number[], string][];
  ce: [unknown, unknown, string, string, { passive?: boolean }][];
  x?: number[];
  l?: Record<string, string[]>;
}
/** data-preload schedule entry: [url, strategy, element ids]. */
type PlanEntry = [string, string, number[]?];
/** What a resumable factory returns (as declared by server-resume itself). */
type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
/** server.d.ts's ServerValue (renderToString input) is a distinct type from the one server-resume.d.ts sees. */
type RenderValue = Parameters<typeof renderToString>[0];
const asRender = (value: unknown): RenderValue => value as RenderValue;
type Component<P = Record<string, unknown>> = (props?: P) => ServerValue;
type ManifestExtra = Partial<ResumeManifest> & {
  preload?: Record<string, string>;
  lazy?: Record<string, string[]>;
  sizes?: Record<string, number>;
  deps?: Record<string, string[]>;
  depsModules?: boolean;
};

const source = `
import { signal, computed, createContext, provide } from "@rivetjs/reactivity";
import { clientEffect, clientEvent } from "@rivetjs/runtime/server";
export const Services = createContext(null, { id: "services" });
export function Counter({ start }) {
  const count = signal(start);
  const label = signal("x</script>");
  const doubled = computed(() => count() * 2);
  const bump = (by) => count.update((v) => v + by);
  let canvas;
  clientEffect(() => { canvas.width = count(); }, { when: "visible" });
  clientEvent(window, "resize", () => bump(1), { passive: true });
  return <div>
    <button class={"b" + count()} title={"static" + start.toString()} onClick={() => bump(1)}>+</button>
    <output>{count()}</output><span>{doubled()}</span><i>{start.toFixed(0)}</i>
    <canvas ref={(el) => (canvas = el)} />
    <input type="text" model:value={label} />
  </div>;
}
export function Plain() {
  return <p class={"a".toUpperCase()}>{String(1)}</p>;
}
export function Bad({ thing }) {
  return <button onClick={() => thing.go()}>go</button>;
}
`;
const manifest: ResumeManifest = {
  hash: "h1",
  runtime: "/rt.js",
  symbols: Object.fromEntries(compileResume(source, "dom").symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const mod = await importServer<{
  Plain: Component;
  Counter: Component<{ start: number }>;
  Bad: Component<{ thing: object }>;
}>(compileResume(source, "server").code);
const stateOf = (html: string): State => readable(JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)![1]!));

test("pages without resumable state render exactly like renderToString", async () => {
  const plain = await resumableToString(() => mod.Plain(), { manifest });
  assert.equal(plain, await renderToString(asRender(mod.Plain())));
  assert.equal(plain, '<p class="A">1</p>');
});

test("outside a recorder, resume-compiled components render plain markup", async () => {
  const html = await renderToString(asRender(mod.Counter({ start: 1 })));
  assert.doesNotMatch(html, /data-r|<!--r|rivet\/state/);
  assert.match(
    html,
    /<button class="b1" title="static1">\+<\/button><output>1<\/output><span>2<\/span><i>1<\/i><canvas><\/canvas><input type="text" value="x&lt;\/script&gt;">/,
  );
});

test("counter records ids, markers, bindings, handlers, model, refs, effects and client events", async () => {
  const html = await resumableToString(() => mod.Counter({ start: 1 }), { manifest });
  assert.match(html, /<button class="b1" title="static1" data-r="0">\+<\/button>/);
  assert.match(html, /<output><!--r1-->1<!--\/--><\/output><span><!--r2-->2<!--\/--><\/span><i>1<\/i>/);
  assert.match(html, /<canvas data-r="3"><\/canvas><input type="text" value="x&lt;\/script&gt;" data-r="4">/);
  assert.match(html, /data-events="click input" data-boot[ >]/);
  assert.match(html, /<\/script><script>\(function\(\)\{/);
  assert.doesNotMatch(/rivet\/state[^>]*>(.*?)<\/script>/s.exec(html)![1]!, /<\/script/);
  const state = stateOf(html);
  assert.equal(state.h, "h1");
  assert.equal(state.rt, "/rt.js");
  assert.deepEqual(state.c, ["/c/Counter.js"]);
  const ref = (r: number) => state.t[r] as Entry;
  const [symbol, captures, chunks] = state.e[0]!.click!;
  assert.match(symbol, /#Counter\$\w+$/);
  assert.deepEqual(chunks, [0]);
  const bump = ref(captures[0]!);
  assert.ok(bump.f);
  const count = ref(bump.a![0]!);
  assert.equal(ref(count.s!), 1);
  // Text and attribute bindings subscribe to the same interned signal.
  const deps = state.b.map((b) => b[4]);
  assert.equal(new Set(deps.flat()).size, 1);
  assert.deepEqual(
    state.b.map((b) => [b[0], b[1]]),
    [
      [0, "class"],
      [1, null],
      [2, null],
    ],
  );
  assert.deepEqual(ref(state.b[2]![3][0]!).c !== undefined, true);
  assert.equal(state.m[4]![0], "value");
  assert.equal(ref(ref(state.m[4]![1]).s!), "x</script>");
  const [fxSymbol, fxCaptures, when] = state.fx[0]!;
  assert.match(fxSymbol, /Counter/);
  assert.equal(when, "visible");
  assert.deepEqual(ref(fxCaptures[0]!), { r: 3 });
  assert.equal(state.ce[0]![2], "w");
  assert.equal(state.ce[0]![3], "resize");
  assert.equal(state.ce[0]![4].passive, true);
});

test("unserializable captures name the symbol and value type", async () => {
  // Dev: the capture index (this manifest has no `captures` names); prod: no index (Function Bridge T19).
  const dev = process.execArgv.includes("--conditions=development");
  await assert.rejects(
    async () => resumableToString(() => mod.Bad({ thing: new (class Robot {})() }), { manifest }),
    dev
      ? /Cannot resume src\/fixture\.tsx#Bad\$\w+: capture #0 Robot instance is not serializable/
      : /Cannot resume src\/fixture\.tsx#Bad\$\w+: Robot instance is not serializable/,
  );
});

test("recording follows async rendering", async () => {
  const html = await resumableToString(() => [Promise.resolve().then(() => mod.Counter({ start: 5 }))], { manifest });
  assert.match(html, /<output><!--r1-->5<!--\/-->/);
  assert.equal(stateOf(html).b.length, 3);
});

const planSource = `
import { signal } from "@rivetjs/reactivity";
import { clientEvent, For } from "@rivetjs/runtime/server";
export function Shown({ count }) {
  return <output>{count()}</output>;
}
export function Rows({ items, picked }) {
  return <ul><For each={() => items} by={(item) => item}>{(item) => <li><button onClick={() => picked.set(item())}>{item()}</button></li>}</For></ul>;
}
export function Page() {
  const count = signal(0);
  const query = signal("");
  const picked = signal("");
  clientEvent(document, "wheel", () => count.set(0), { passive: false });
  return <main>
    <button onClick={() => count.update((v) => v + 1)}>+</button>
    <Shown count={count} />
    <input model:value={query} />
    <Echo text={query} />
    <Rows items={["a", "b", "c"]} picked={picked} />
  </main>;
}
export function Echo({ text }) {
  return <p>{text()}</p>;
}
`;
const planSymbols = compileResume(planSource, "dom").symbols;
const planManifest = (extra: ManifestExtra = {}): ResumeManifest => ({
  runtime: "/rt.js",
  symbols: Object.fromEntries(planSymbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
  ...extra,
});
const planMod = await importServer<{ Page: Component; Shown: Component<{ count: () => number }> }>(compileResume(planSource, "server").code);
const scheduleOf = (html: string): PlanEntry[] | null => {
  const attr = /data-preload="([^"]*)"/.exec(html)?.[1];
  return attr ? (JSON.parse(attr.replace(/&quot;/g, '"').replace(/&amp;/g, "&")) as PlanEntry[]) : null;
};

test("preload plan: dependency prefetch, repeated rows visible, passive:false eager", async () => {
  const html = await resumableToString(() => planMod.Page(), { manifest: planManifest() });
  const state = stateOf(html);
  const url = (i: number) => state.c[i];
  // The + handler lives in Page's chunk; the text it updates lives in Shown's: intent prefetches both.
  const plus = Object.values(state.e).find((h) => h.click && url(h.click[2][0]!) === "/c/Page.js")!.click!;
  assert.deepEqual(plus[3]!.map(url), ["/c/Shown.js"]);
  // model:value needs no app chunk, but its readers' chunk is prefetched with it.
  const model = Object.values(state.m)[0]!;
  assert.deepEqual(model[2].map(url), ["/c/Echo.js"]);
  // Schedule: runtime first; Rows (3 row handlers) visible with its element ids; the wheel listener eager.
  const [runtime, ...plan] = scheduleOf(html)!;
  assert.equal(runtime, "/rt.js");
  const rows = plan.find(([u]) => u === "/c/Rows.js")!;
  assert.equal(rows[1], "v");
  assert.equal(rows[2]!.length, 3);
  assert.ok(plan.some(([u, s]) => u === "/c/Page.js" && s === "e"));
  assert.equal(state.x, undefined);
});

test("preload plan: app rules override automatic strategies; interaction chunks are listed", async () => {
  const rowSymbol = planSymbols.find((s) => s.component === "Rows")!.id;
  const plusSymbol = planSymbols.find((s) => s.component === "Page" && s.kind === "event")!.id;
  const html = await resumableToString(() => planMod.Page(), {
    manifest: planManifest({ preload: { [rowSymbol]: "interaction", [plusSymbol]: "idle" } }),
  });
  const state = stateOf(html);
  const [, ...plan] = scheduleOf(html)!;
  assert.ok(!plan.some(([u]) => u === "/c/Rows.js"));
  assert.deepEqual(
    state.x!.map((i) => state.c[i]),
    ["/c/Rows.js"],
  );
  assert.ok(plan.some(([u, s]) => u === "/c/Page.js" && s === "i"));
});

test("pages with only intent handlers carry no preload schedule", async () => {
  const html = await resumableToString(() => planMod.Shown({ count: () => 1 }), { manifest: planManifest() });
  assert.doesNotMatch(html, /data-preload/);
});

const rowSource = `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/server";
export function Indexed() {
  const q = signal("");
  return <ul><For each={() => ["a", "b"].filter((x) => x.includes(q()))} by={(x) => x}>{(x, i) => <li>{i()}:{x()}</li>}</For></ul>;
}
export function Plain() {
  const q = signal("");
  return <ul><For each={() => ["a", "b"].filter((x) => x.includes(q()))} by={(x) => x}>{(x) => <li>{x()}</li>}</For></ul>;
}
function Two({ q }) {
  return <>
    <For each={() => ["a"].filter((x) => x.includes(q()))} by={(x) => x}>{(x) => <i>{x()}</i>}</For>
    <For each={() => ["b"].filter((x) => x.includes(q()))} by={(x) => x}>{(x) => <b>{x()}</b>}</For>
  </>;
}
export function Twice() {
  const q = signal("");
  return <div><Two q={q} /></div>;
}
`;
const rowSymbols = compileResume(rowSource, "dom").symbols;
const rowManifest: ResumeManifest = { runtime: "/rt.js", symbols: Object.fromEntries(rowSymbols.map((s) => [s.id, "/c/" + s.component + ".js"])) };
const rowMod = await importServer<{ Indexed: Component; Plain: Component; Twice: Component }>(compileResume(rowSource, "server").code);
const regionOfList = (html: string): Binding | undefined => stateOf(html).b.find((b) => b[1] === "#");

test("For rows render as row regions with key, item and index use", async () => {
  const plain = await resumableToString(() => rowMod.Plain(), { manifest: rowManifest });
  const [node, , , , , , , , listRows] = regionOfList(plain)!;
  const rows = listRows as number[];
  assert.equal(rows.length, 6);
  const state = stateOf(plain);
  assert.deepEqual([state.t[rows[1]!], rows[2]], ["a", 0]);
  assert.match(plain, new RegExp(`<!--r${node}\\[--><!--r${rows[0]}\\[--><li>a</li><!--\\]-->`));
  const indexed = regionOfList(await resumableToString(() => rowMod.Indexed(), { manifest: rowManifest }))!;
  const indexedRows = indexed[8] as number[];
  assert.deepEqual([indexedRows[2], indexedRows[5]], [1, 1]);
  // Two lists in one region: rows are not adoptable, the region is re-created.
  assert.equal(regionOfList(await resumableToString(() => rowMod.Twice(), { manifest: rowManifest }))![8], undefined);
});

const tplSource = `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/server";
export function List() {
  const q = signal("");
  const picked = signal("");
  return <ul><For each={() => ["a", "b", "c"].filter((x) => x.includes(q()))} by={(x) => x}>{(x) =>
    <li class={picked() === x() ? "on" : ""}><button onClick={() => picked.set(x())}>{x()}</button></li>}</For></ul>;
}
export function Mixed() {
  const q = signal("");
  return <ul><For each={() => ["a", "b"].filter((x) => x.includes(q()))} by={(x) => x}>{(x) =>
    x() === "a" ? <li><button onClick={() => q.set("")}>a</button></li> : <li>b</li>}</For></ul>;
}
`;
const tplSymbols = compileResume(tplSource, "dom").symbols;
const tplManifest: ResumeManifest = { runtime: "/rt.js", symbols: Object.fromEntries(tplSymbols.map((s) => [s.id, "/c/" + s.component + ".js"])) };
const tplMod = await importServer<{ List: Component; Mixed: Component }>(compileResume(tplSource, "server").code);

test("uniform For rows encode one template instead of per-row entries", async () => {
  const state = stateOf(await resumableToString(() => tplMod.List(), { manifest: tplManifest }));
  const [, , , , , , , , compact, template] = state.b.find((b) => b[1] === "#")!;
  const rows = compact as Rows,
    tpl = template!;
  // Compact rows: ids by stride, items as the captured list's own table array, keys recomputed in the browser.
  assert.equal(rows.d, 3);
  // Literal items: the list itself is inlined ({l}), so rows carry explicit item refs.
  assert.deepEqual(
    rows.r.map((ref) => state.t[ref]),
    ["a", "b", "c"],
  );
  assert.equal(rows.x, undefined);
  // li (offset 1): class binding; button (offset 2): handler capturing [picked, row item] → [ref, -2].
  assert.deepEqual(Object.keys(tpl.e), ["2"]);
  assert.equal(tpl.e[2]!.click![1].at(-1), -2);
  assert.deepEqual(
    tpl.b.map((b) => [b[0], b[1]]),
    [[1, "class"]],
  );
  for (let k = 0; k < 3; k++) assert.equal(state.e[rows.i + k * rows.d + 2], undefined);
  assert.equal(state.b.length, 1);
  assert.equal(state.t.filter((entry) => (entry as Entry | null)?.k === "const").length, 0);
  // Rows with different shapes keep explicit entries.
  const mixed = stateOf(await resumableToString(() => tplMod.Mixed(), { manifest: tplManifest }));
  assert.equal(mixed.b.find((b) => b[1] === "#")![9], undefined);
  assert.equal(Object.keys(mixed.e).length, 1);
});

// Row packing (live set): uniform rows drop their records while rendering; a row that breaks uniformity
// (or items that do not serialize) brings every packed row's records back, as if never packed.
const packSource = `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/server";
export function Rows({ items }) {
  const q = signal("");
  const picked = signal("");
  return <ul><For each={() => items.filter((x) => String(x.k ?? x).includes(q()))} by={(x) => x.k ?? x}>{(x) =>
    x() === "z" ? <li>z</li> : <li class={picked() === x() ? "on" : ""}><button onClick={() => picked.set(x())}>{x()}</button></li>}</For></ul>;
}
export function Opaque({ items }) {
  const q = signal("");
  const picked = signal("");
  return <ul><For each={() => items.filter(() => q() === "")} by={(x) => x.k}>{(x) =>
    <li class={picked() ? "on" : ""}><button onClick={() => picked.set("k")}>{x().k}</button></li>}</For></ul>;
}
`;
const packSymbols = compileResume(packSource, "dom").symbols;
const packManifest: ResumeManifest = { runtime: "/rt.js", symbols: Object.fromEntries(packSymbols.map((s) => [s.id, "/c/" + s.component + ".js"])) };
const packMod = await importServer<{ Rows: Component<{ items: unknown[] }>; Opaque: Component<{ items: unknown[] }> }>(
  compileResume(packSource, "server").code,
);

/** Per row (element id order): [handler symbol, captured row item] and [binding name, symbol, captured row item]. */
function explicitRows(state: State): unknown[] {
  const item = (ref: number) => {
    const entry = state.t[ref] as Entry;
    return entry?.k === "const" ? state.t[entry.a![0]!] : "#" + typeof entry;
  };
  const handlers = Object.keys(state.e)
    .map(Number)
    .sort((a, b) => a - b)
    .map((id) => ["click", state.e[id]!.click![0], item(state.e[id]!.click![1].at(-1)!)]);
  const bindings = state.b.filter((b) => b[1] === "class").map((b) => ["class", b[2], item((b[3] as number[]).at(-1)!)]);
  return [handlers, bindings];
}

test("row packing: a late non-uniform row restores every packed row's entries (same as a first-row deviation)", async () => {
  const late = stateOf(await resumableToString(() => packMod.Rows({ items: ["a", "b", "c", "d", "z"] }), { manifest: packManifest }));
  const first = stateOf(await resumableToString(() => packMod.Rows({ items: ["z", "a", "b", "c", "d"] }), { manifest: packManifest }));
  for (const state of [late, first]) assert.equal(state.b.find((b) => b[1] === "#")![9], undefined, "no row template");
  const [handlers, bindings] = explicitRows(late) as unknown[][];
  assert.deepEqual(
    handlers!.map((h) => (h as unknown[])[2]),
    ["a", "b", "c", "d"],
  );
  assert.deepEqual(
    bindings!.map((b) => (b as unknown[])[2]),
    ["a", "b", "c", "d"],
  );
  assert.deepEqual(explicitRows(late), explicitRows(first));
  // Element ids: each row's button and li keep their own ids (row id + the reference's offsets).
  const region = late.b.find((b) => b[1] === "#")!;
  const rows = region[8] as number[];
  const buttons = Object.keys(late.e).map(Number);
  for (let k = 0; k < 4; k++) assert.ok(buttons.includes(rows[k * 3]! + 2), `row ${k} button id`);
  assert.deepEqual(
    late.b.filter((b) => b[1] === "class").map((b) => b[0] - rows[late.b.filter((x) => x[1] === "class").indexOf(b) * 3]!),
    [1, 1, 1, 1],
  );
  // Uniform rows still encode one template.
  const uniform = stateOf(await resumableToString(() => packMod.Rows({ items: ["a", "b", "c", "d"] }), { manifest: packManifest }));
  assert.ok(uniform.b.find((b) => b[1] === "#")![9]);
  assert.equal(Object.keys(uniform.e).length, 0);
});

test("row packing: rebuilt rows get one item getter and one index getter each, shared by their records", async () => {
  const src = `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/server";
export function Rows({ items }) {
  const q = signal("");
  const picked = signal("");
  return <ul><For each={() => items.filter((x) => x.includes(q()))} by={(x) => x}>{(x, i) =>
    x() === "z" ? <li>z</li> : <li class={picked() === x() ? "on" : ""}><button onClick={() => picked.set(x() + i())}>{x()}</button></li>}</For></ul>;
}`;
  const symbols = compileResume(src, "dom").symbols;
  const man: ResumeManifest = { runtime: "/rt.js", symbols: Object.fromEntries(symbols.map((s) => [s.id, "/c.js"])) };
  const m = await importServer<{ Rows: Component<{ items: string[] }> }>(compileResume(src, "server").code);
  const state = stateOf(await resumableToString(() => m.Rows({ items: ["a", "b", "c", "d", "z"] }), { manifest: man }));
  const constant = (ref: number) => {
    const entry = state.t[ref] as Entry;
    assert.equal(entry.k, "const");
    return state.t[entry.a![0]!];
  };
  const handlers = Object.keys(state.e)
    .map(Number)
    .sort((a, b) => a - b)
    .map((id) => state.e[id]!.click![1]);
  const bindings = state.b.filter((b) => b[1] === "class").map((b) => b[3] as number[]);
  assert.equal(handlers.length, 4);
  for (let k = 0; k < 4; k++) {
    const [item, index] = handlers[k]!.slice(-2) as [number, number];
    assert.equal(constant(item), "abcd"[k]);
    assert.equal(constant(index), k);
    assert.equal(bindings[k]!.at(-1), item, `row ${k}: binding and handler share the item getter`);
  }
});

test("row packing: items that do not serialize bring the packed rows' entries back", async () => {
  const opaque = () => 1;
  const items = ["a", "b", "c", "d"].map((k) => ({ k, opaque }));
  const state = stateOf(await resumableToString(() => packMod.Opaque({ items }), { manifest: packManifest }));
  const region = state.b.find((b) => b[1] === "#")!;
  assert.equal(region[9], undefined);
  assert.equal(Object.keys(state.e).length, 4);
  // One class binding per row: single entries, or one packed run (`g`: each row in its own row region).
  const packed = state.b.find((b) => b[1] === "+")?.[8] as { k: number; g?: 1; b: unknown[][] } | undefined;
  assert.equal(state.b.filter((b) => b[1] === "class").length + (packed ? packed.k * packed.b.filter((t) => t[1] === "class").length : 0), 4);
  if (packed) assert.equal(packed.g, 1);
});

test("preload plan: scheduled chunks bring their lazy imports at idle, never earlier", async () => {
  const html = await resumableToString(() => planMod.Page(), { manifest: planManifest({ lazy: { "/c/Rows.js": ["/c/route.js"] } }) });
  const [, ...plan] = scheduleOf(html)!;
  assert.equal(plan.find(([u]) => u === "/c/Rows.js")![1], "v");
  assert.deepEqual(plan.at(-1), ["/c/route.js", "i"]);
  assert.deepEqual(stateOf(html).l, { [stateOf(html).c.indexOf("/c/Rows.js")]: ["/c/route.js"] });
});

test("equals comparators serialize as symbols; equals: false as a flag; opaque comparators fail clearly", async () => {
  const src = `
import { signal, computed } from "@rivetjs/reactivity";
const byId = (a, b) => a.id === b.id;
export function Eq() {
  const item = signal({ id: 1 }, { equals: byId });
  const plain = signal(0);
  const loud = signal(0, { equals: false });
  const even = computed(() => plain() % 2, { equals: (a, b) => a === b });
  return <p onClick={() => (item.set({ id: 2 }), loud.set(0))}>{even()}</p>;
}
export function Opaque({ options }) {
  const item = signal(1, options);
  return <p onClick={() => item.set(2)}>x</p>;
}`;
  const dom = compileResume(src, "dom");
  const m = await importServer<{ Eq: Component; Opaque: Component<{ options: { equals: (a: unknown, b: unknown) => boolean } }> }>(
    compileResume(src, "server").code,
  );
  const man: ResumeManifest = { hash: "h", runtime: "/rt.js", symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c.js"])) };
  const { t } = stateOf(await resumableToString(() => m.Eq(), { manifest: man }));
  const signals = t.filter((entry): entry is Entry => typeof entry === "object" && entry !== null && "s" in entry);
  const [item, plain, loud] = [signals.find((e) => typeof e.q === "number"), signals.find((e) => !("q" in e)), signals.find((e) => e.q === false)];
  assert.ok(item && plain && loud);
  // A module-level comparator is a module reference (Function Bridge T3: `_rMod` stamp wins over the `equals` site's `_rFn`).
  assert.equal(dom.symbols.find((s) => s.id === (t[item!.q as number] as Entry).f)!.kind, "ref");
  assert.match((t[item!.q as number] as Entry).f as string, /#byId\$l\$[0-9a-z]{5}\$ref$/);
  const even = t.find((entry): entry is Entry => typeof entry === "object" && entry !== null && "c" in entry)!;
  assert.equal(dom.symbols.find((s) => s.id === (t[even.q as number] as Entry).f)!.kind, "equals");
  await assert.rejects(
    resumableToString(() => m.Opaque({ options: { equals: (a, b) => a === b } }), { manifest: man }) as Promise<string>,
    /equals comparator is not resumable/,
  );
});

const directiveSource = `
import { signal } from "@rivetjs/reactivity";
export function Plain({ n }) {
  return <button preload="idle" onClick={() => n.set(1)}>plain</button>;
}
export function Link({ n }) {
  return <a href="/next" preload="idle" onClick={() => n.set(2)}>next</a>;
}
export function Shown({ n }) {
  return <button preload="visible" onClick={() => n.set(3)}>shown</button>;
}
export function Auto({ n }) {
  return <button onClick={() => n.set(4)}>auto</button>;
}
export function Page() {
  const n = signal(0);
  return <main><Plain n={n} /><Link n={n} /><Shown n={n} /><Auto n={n} /></main>;
}
`;
const directiveSymbols = compileResume(directiveSource, "dom").symbols;
const directiveManifest = (extra: ManifestExtra = {}): ResumeManifest => ({
  runtime: "/rt.js",
  symbols: Object.fromEntries(directiveSymbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
  ...extra,
});
const directiveMod = await importServer<{ Page: Component }>(compileResume(directiveSource, "server").code);

test("preload plan: element preload directive overrides automatic intent and app rules; nav handlers rank first", async () => {
  const autoSymbol = directiveSymbols.find((s) => s.component === "Auto")!.id;
  const shownSymbol = directiveSymbols.find((s) => s.component === "Shown")!.id;
  const html = await resumableToString(() => directiveMod.Page(), {
    manifest: directiveManifest({ preload: { [shownSymbol]: "interaction" } }),
  });
  assert.doesNotMatch(html, /\spreload=/);
  const plan = scheduleOf(html)!;
  const of = (url: string) => plan.find(([u]) => u === url);
  assert.equal(of("/c/Plain.js")![1], "i");
  assert.equal(of("/c/Shown.js")![1], "v");
  // Same strategy, same weight: the <a href> handler gets the navigation bonus and loads first.
  assert.ok(plan.indexOf(of("/c/Link.js")!) < plan.indexOf(of("/c/Plain.js")!));
  // No directive: automatic intent, not scheduled.
  assert.equal(of("/c/Auto.js"), undefined);
  assert.ok(directiveSymbols.some((s) => s.id === autoSymbol));
});

// Framework component elements with constant props are plain calls (no region site). Whatever such a
// call reads while rendering attributes to the enclosing region, which the browser re-creates on change.
const photoModule =
  `import { signal } from ${JSON.stringify(import.meta.resolve("@rivetjs/reactivity"))};` +
  ` export const variant = signal("a");` +
  ` export const photo = { get src() { return "/" + variant() + ".jpg"; }, width: 4, height: 3, layout: "fixed", sources: [{ type: "image/jpeg", srcset: "/a.jpg" }] };`;
const staticSource = `
import { signal } from "@rivetjs/reactivity";
import { Picture } from "@rivetjs/runtime/image";
import { photo } from "./photo.js";
export function Gallery() {
  const open = signal(true);
  return <main>
    <button onClick={() => open.set(!open())}>t</button>
    <Picture image={photo} alt="" />
    {open() ? <section><Picture image={photo} alt="" /></section> : null}
  </main>;
}
`;
const staticDom = compileResume(staticSource, "dom");
const staticMod = await importServer<{ Gallery: Component; variant: unknown }>(
  compileResume(staticSource, "server")
    .code.replaceAll('"@rivetjs/runtime/image"', JSON.stringify(import.meta.resolve("@rivetjs/runtime/image")))
    .replaceAll('"./photo.js"', JSON.stringify("data:text/javascript;base64," + Buffer.from(photoModule).toString("base64"))),
);

test("static framework components: plain calls; their reads attribute to the enclosing region", async () => {
  assert.deepEqual(
    staticDom.symbols.map((s) => s.kind),
    ["event", "bind"],
  );
  const html = await resumableToString(() => staticMod.Gallery(), {
    manifest: { runtime: "/rt.js", symbols: Object.fromEntries(staticDom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])) },
  });
  // Top-level Picture: no markers; inside the conditional: one region around the section.
  assert.match(html, /<button data-r="0">t<\/button><img src="\/a\.jpg"[^>]*><!--r1\[--><section><img src="\/a\.jpg"[^>]*><\/section><!--\]-->/);
  const state = stateOf(html);
  assert.equal(state.b.length, 1);
  // The region depends on `open` and on the signal Picture read while rendering inside it.
  const values = state.b[0]![4].map((r) => state.t[(state.t[r] as Entry).s!]);
  assert.deepEqual(values.sort(), ["a", true]);
});

test("_rUnrecorded: a build pass over wrapped / conditional content records nothing; rendering after it still records", async () => {
  const source = `import { signal } from "@rivetjs/reactivity";
import { _rUnrecorded } from "@rivetjs/runtime/resume-format";
const Item = (p: { k: string }) => <i>{p.k}</i>;
export function Page() {
  const c = signal(true);
  const build = _rUnrecorded(() => <div>{c() && <Item k="a" />}<section><Item k="b" /></section></div>);
  return <main data-built={build != null ? "1" : "0"}><p id="p" onClick={() => c.set(!c())}>{c() ? "y" : "n"}</p>{c() && <b>live</b>}</main>;
}`;
  const mod = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/unrecorded.tsx").code);
  const symbols = Object.fromEntries(compileResume(source, "dom", "src/unrecorded.tsx").symbols.map((s) => [s.id, "/c/Page.js"]));
  const html = await resumableToString(() => mod.Page(), { manifest: { hash: "u", runtime: "/rt.js", symbols } });
  const state = stateOf(html);
  // Only the live bindings after the pass: the text + the region of `{c() && <b/>}`; the build pass's
  // conditional (`{c() && <Item/>}`) and its wrapper recorded no region.
  assert.equal(state.b.length, 2, JSON.stringify(state.b));
  assert.equal(state.b.filter((b) => b[1] === "#").length, 1, JSON.stringify(state.b));
  assert.match(html, /<main data-built="1"><p id="p" data-r="\d+"><!--r\d+-->y<!--\/--><\/p><!--r\d+\[--><b>live<\/b><!--\]--><\/main>/);
  assert.doesNotMatch(html, /<i>a<\/i>|<section>/);
  // Outside a resumable render: plain `fn()`.
  assert.equal(await renderToString(() => mod.Page()), '<main data-built="1"><p id="p">y</p><b>live</b></main>');
});

test("_rUnrecorded: functions created inside the pass keep their symbol recipes (a collection item's handler rendered later resumes)", async () => {
  // cdk collections: the build pass evaluates item props (`<Item onDblClick={() => …}/>`) unrecorded, then
  // renders the item from those props — its spread handler must still be a known `_rFn`.
  const source = `import { signal } from "@rivetjs/reactivity";
import { _rUnrecorded } from "@rivetjs/runtime/resume-format";
export function Page() {
  const n = signal(0);
  let props: Record<string, unknown> = {};
  const Item = (p: Record<string, unknown>) => ((props = p), null);
  _rUnrecorded(() => <Item onDblClick={() => n.set(n() + 1)} />);
  return <main><b id="b" {...props}>{n()}</b></main>;
}`;
  const mod = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/unrecorded-fn.tsx").code);
  const symbols = Object.fromEntries(compileResume(source, "dom", "src/unrecorded-fn.tsx").symbols.map((s) => [s.id, "/c/Page.js"]));
  const html = await resumableToString(() => mod.Page(), { manifest: { hash: "u", runtime: "/rt.js", symbols } });
  assert.match(html, /<b id="b" data-r="\d+">/);
  assert.ok(
    Object.values(stateOf(html).e).some((e) => "dblclick" in e),
    JSON.stringify(stateOf(html).e),
  );
});

test("byte writers get hoisted marker and loader fragments: same bytes as strings, encoded once per process", async () => {
  const { renderResumable } = await import("@rivetjs/runtime/server-resume");
  const decoder = new TextDecoder();
  const render = (nonce?: string) => {
    const writes: (string | Uint8Array | number)[] = [];
    const sink = {
      write: (chunk: string) => void writes.push(chunk),
      writeBytes: (bytes: Uint8Array) => void writes.push(bytes),
      writeInteger: (n: number) => void writes.push(n),
    };
    assert.equal(
      renderResumable(() => mod.Counter({ start: 1 }), sink, { manifest, nonce }),
      undefined,
    );
    return writes;
  };
  const text = (writes: (string | Uint8Array | number)[]) =>
    writes.map((w) => (typeof w === "string" ? w : typeof w === "number" ? String(w) : decoder.decode(w))).join("");
  for (const nonce of [undefined, "n+/=-1", 'bad"<nonce>']) {
    const first = render(nonce),
      second = render(nonce);
    assert.equal(text(first), await resumableToString(() => mod.Counter({ start: 1 }), { manifest, nonce }));
    const loader = (writes: typeof first) => writes.find((w): w is Uint8Array => w instanceof Uint8Array && decoder.decode(w).includes("(function(){"));
    assert.ok(loader(first));
    assert.equal(loader(first), loader(second));
    // `<!--r` opens every text marker from one shared fragment; ids go through writeInteger.
    const opens = first.filter((w): w is Uint8Array => w instanceof Uint8Array && decoder.decode(w).endsWith("<!--r"));
    assert.ok(opens.length >= 2);
    assert.equal(new Set(opens).size, 1);
    assert.ok(first.includes(1) && first.includes(2));
  }
});

// Automatic `visible` is for list rows with small chunks: N independent instances of one component
// are not a list, a large row chunk waits for intent, and pointerdown / focus / invalid are intent-class.
const costSource = `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/server";
export function Cell({ n }) {
  return <button onClick={() => n.set(1)}>cell</button>;
}
export function Grid() {
  const n = signal(0);
  return <main>{[0, 1, 2, 3, 4, 5, 6, 7, 8].map(() => <Cell n={n} />)}</main>;
}
export function Rows() {
  const picked = signal("");
  return <ul><For each={() => ["a", "b", "c", "d"]} by={(x) => x}>{(x) => <li><button onClick={() => picked.set(x())}>{x()}</button></li>}</For></ul>;
}
export function Press() {
  const n = signal(0);
  return <div onPointerDown={() => n.set(1)} onFocus={() => n.set(2)}><input onInvalid={() => n.set(3)} /><form onInvalidCapture={() => n.set(4)} onClickCapture={() => n.set(5)} /></div>;
}
`;
const costSymbols = compileResume(costSource, "dom").symbols;
const costManifest = (extra: ManifestExtra = {}): ResumeManifest => ({
  runtime: "/rt.js",
  symbols: Object.fromEntries(costSymbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
  ...extra,
});
const costMod = await importServer<{ Grid: Component; Rows: Component; Press: Component }>(compileResume(costSource, "server").code);

test("preload plan: independent instances of one handler symbol stay intent; template rows go visible", async () => {
  assert.equal(scheduleOf(await resumableToString(() => costMod.Grid(), { manifest: costManifest() })), null);
  const plan = scheduleOf(await resumableToString(() => costMod.Rows(), { manifest: costManifest() }))!;
  assert.equal(plan.find(([u]) => u === "/c/Rows.js")![1], "v");
});

test("preload plan: a row chunk over the visible byte budget waits for intent", async () => {
  const html = await resumableToString(() => costMod.Rows(), { manifest: costManifest({ sizes: { "/c/Rows.js": 64_000 } }) });
  assert.equal(scheduleOf(html), null);
  // An app rule still forces it.
  const rowSymbol = costSymbols.find((s) => s.component === "Rows" && s.kind === "event")!.id;
  const forced = await resumableToString(() => costMod.Rows(), {
    manifest: costManifest({ sizes: { "/c/Rows.js": 64_000 }, preload: { [rowSymbol]: "visible" } }),
  });
  // Known size inside the background budget: visible + background prefetch at idle.
  assert.equal(scheduleOf(forced)!.find(([u]) => u === "/c/Rows.js")![1], "P");
});

test("preload plan: visible chunks get background prefetch only while their new closures fit the budget", async () => {
  const rowSymbol = costSymbols.find((s) => s.component === "Rows" && s.kind === "event")!.id;
  const planOf = async (extra: ManifestExtra, background?: number) => {
    const manifest = costManifest({ preload: { [rowSymbol]: "visible" }, ...extra });
    const html = await resumableToString(() => costMod.Rows(), { manifest, ...(background === undefined ? {} : { preload: { background } }) });
    return scheduleOf(html)!.find(([u]) => u === "/c/Rows.js")!;
  };
  const deps = { "/c/Rows.js": ["/c/shared.js"] };
  const sizes = { "/c/Rows.js": 10_000, "/c/shared.js": 190_000 };
  // Default budget (1 MiB): 200 KB of closure fits.
  assert.equal((await planOf({ sizes, deps }))[1], "P");
  // Own 10 KB + a 190 KB shared chunk over a 192 KB budget: viewport-only, ids kept.
  const over = await planOf({ sizes, deps }, 192 * 1024);
  assert.equal(over[1], "v");
  assert.ok(over[2]!.length > 0);
  // The runtime already brings the shared chunk: only the 10 KB counts.
  assert.equal((await planOf({ sizes, deps: { ...deps, "/rt.js": ["/c/shared.js"] } }, 192 * 1024))[1], "P");
  // `0`: off. Unknown sizes (dev, older manifests): viewport-only.
  assert.equal((await planOf({ sizes, deps }, 0))[1], "v");
  assert.equal((await planOf({ deps }))[1], "v");
});

test("deps modules: the state script flags them (data-deps) when the build wrote them", async () => {
  assert.match(
    await resumableToString(() => costMod.Rows(), { manifest: costManifest({ depsModules: true }) }),
    /<script type="rivet\/state"[^>]* data-deps[ >]/,
  );
  assert.doesNotMatch(await resumableToString(() => costMod.Rows(), { manifest: costManifest() }), /data-deps/);
});

test("preload plan: pointerdown, focus and invalid handlers are intent-class", async () => {
  assert.equal(scheduleOf(await resumableToString(() => costMod.Press(), { manifest: costManifest() })), null);
});

test("state script JSON is exactly JSON.stringify's (fast serializer for the integer-keyed e / m / l maps)", async () => {
  const raw = (html: string) => /<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)![1]!.replace(/\\u003c/g, "<");
  for (const html of [
    await resumableToString(() => mod.Counter({ start: 1 }), { manifest }),
    await resumableToString(() => planMod.Page(), { manifest: planManifest({ lazy: { "/c/Rows.js": ["/c/route.js"] } }) }),
    await resumableToString(() => tplMod.Mixed(), { manifest: tplManifest }),
  ]) {
    const text = raw(html);
    const state = JSON.parse(text) as State;
    assert.equal(JSON.stringify(state), text);
    assert.ok(Object.keys(state.e).length > 0);
  }
});

const lazyRouterSource = `
import { clientEvent } from "@rivetjs/runtime/server";
export function Nav() {
  clientEvent(document, "click", (event) => event.preventDefault(), { preload: "intent" });
  return <nav><a href="/next">next</a></nav>;
}
`;
const lazyRouterSymbols = compileResume(lazyRouterSource, "dom").symbols;
const lazyRouterMod = await importServer<{ Nav: Component }>(compileResume(lazyRouterSource, "server").code);
test("Z1: an intent document click listener does not boot; its chunk (+ runtime) is fetched, never evaluated, after load", async () => {
  const manifest = {
    runtime: "/rt.js",
    loader: "/ld.js",
    symbols: Object.fromEntries(lazyRouterSymbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
    // Static import closures (modulepreload fetches one module): listed once each.
    deps: { "/rt.js": ["/dom.js"], "/c/Nav.js": ["/dom.js", "/client.js"] },
  } as ResumeManifest;
  const html = await resumableToString(() => lazyRouterMod.Nav(), { manifest });
  const state = stateOf(html) as State & { n?: number[] };
  assert.deepEqual(
    state.n!.map((i) => state.c[i]),
    ["/c/Nav.js"],
  );
  const script = /<script type="rivet\/state"[^>]*>/.exec(html)![0];
  assert.doesNotMatch(script, / data-boot/);
  assert.match(script, /data-events="[^"]*\bclick\b/);
  // Fetch-only hints (`data-fo`, the loader module adds them after the load event); no `<link>` in the HTML.
  assert.match(script, / data-fo="\/rt\.js \/dom\.js \/c\/Nav\.js \/client\.js"/);
  assert.doesNotMatch(html, /<link rel="modulepreload"/);
  // Without the loader module (no manifest `loader`): none.
  assert.doesNotMatch(String(await resumableToString(() => lazyRouterMod.Nav(), { manifest: { ...manifest, loader: undefined } })), /data-fo=/);
  // Never in the evaluating preload schedule.
  assert.ok(!(scheduleOf(html) ?? []).some((entry) => Array.isArray(entry) && entry[0] === "/c/Nav.js"));
});

const routeChunkSource = `
import { signal } from "@rivetjs/reactivity";
export function Counter() {
  const n = signal(0);
  return <button onClick={() => n.set(n() + 1)}>{n()}</button>;
}
`;
const routeChunkMod = await importServer<{ Counter: Component }>(compileResume(routeChunkSource, "server").code);
test("route chunks (manifest fetchAhead) + preload.ahead: the page's own chunks are fetched ahead too, never on lean pages", async () => {
  const symbols = compileResume(routeChunkSource, "dom").symbols;
  const manifest = {
    runtime: "/rt.js",
    loader: "/ld.js",
    fetchAhead: true,
    symbols: Object.fromEntries(symbols.map((s) => [s.id, "/c/route.js"])),
    deps: { "/rt.js": ["/dom.js"], "/c/route.js": ["/dom.js", "/shared.js"] },
  } as ResumeManifest;
  const tag = async (options: object) =>
    /<script type="rivet\/state"[^>]*>/.exec(String(await resumableToString(() => routeChunkMod.Counter(), { manifest, ...options })))![0];
  assert.match(await tag({ preload: { ahead: true } }), / data-fo="\/rt\.js \/dom\.js \/c\/route\.js \/shared\.js"/);
  // No document prefetch (no `ahead`), lean pages, component builds (no `fetchAhead`): nothing ahead.
  assert.doesNotMatch(await tag({}), /data-fo=/);
  assert.doesNotMatch(await tag({ preload: { ahead: true, lean: true } }), /data-fo=/);
  assert.doesNotMatch(await tag({ preload: { ahead: true }, manifest: { ...manifest, fetchAhead: undefined } }), /data-fo=/);
});

const standaloneSource = `
import { signal } from "@rivetjs/reactivity";
import { clientEvent } from "@rivetjs/runtime/server";
export function Nav() {
  clientEvent(document, "click", (event) => event.preventDefault(), { preload: "intent", standalone: false });
  return <nav><a href="/next">next</a></nav>;
}
export function Live() {
  const count = signal(0);
  clientEvent(document, "click", (event) => event.preventDefault(), { preload: "intent", standalone: false });
  return <button onClick={() => count.set(count() + 1)}>{count()}</button>;
}
`;
const standaloneSymbols = compileResume(standaloneSource, "dom").symbols;
const standaloneMod = await importServer<{ Nav: Component; Live: Component }>(compileResume(standaloneSource, "server").code);
test("standalone: false listeners alone ship nothing (no state, loader, preloads); with anything else to resume they do", async () => {
  const manifest = {
    runtime: "/rt.js",
    symbols: Object.fromEntries(standaloneSymbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
  } as ResumeManifest;
  const inert = await resumableToString(() => standaloneMod.Nav(), { manifest });
  assert.equal(inert, '<nav><a href="/next">next</a></nav>');
  const live = await resumableToString(() => standaloneMod.Live(), { manifest });
  const script = /<script type="rivet\/state"[^>]*>/.exec(live)![0];
  assert.match(script, /data-events="[^"]*\bclick\b/);
  // The listener resumes with the page; its option stays server-side.
  assert.doesNotMatch(live, /standalone/);
  assert.ok((stateOf(live) as State).c.includes("/c/Live.js"));
});

test("preload.lean: no schedule (visible / background / idle) and no router fetch-ahead; handlers stay in the state", async () => {
  const rowSymbol = costSymbols.find((s) => s.component === "Rows" && s.kind === "event")!.id;
  const manifest = costManifest({ preload: { [rowSymbol]: "visible" }, sizes: { "/c/Rows.js": 10_000 } });
  assert.ok(scheduleOf(await resumableToString(() => costMod.Rows(), { manifest })), "planned without lean");
  const lean = await resumableToString(() => costMod.Rows(), { manifest, preload: { lean: true } });
  assert.equal(scheduleOf(lean), null);
  assert.ok((stateOf(lean) as State).c.includes("/c/Rows.js"), "the row chunk still resumes (on intent / interaction)");
  const routerManifest = {
    runtime: "/rt.js",
    symbols: Object.fromEntries(lazyRouterSymbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
  } as ResumeManifest;
  const nav = await resumableToString(() => lazyRouterMod.Nav(), { manifest: routerManifest, preload: { lean: true } });
  assert.doesNotMatch(nav, /<link rel="modulepreload"/);
  // The cold link click still loads the router: its chunk stays in `n`.
  assert.deepEqual((stateOf(nav) as State & { n?: number[] }).n?.length, 1);
});
