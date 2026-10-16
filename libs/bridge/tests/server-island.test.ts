// T3 `_island` server: wrapper + per-request ids, policy props stripped, dev attributes, policy recording (hydration
// effect + `_rPreload`), hydrate-on-change tracker, page-level adapter head, hoisted head, `client="only"`.
import { test, vi } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { withIdScope } from "@rivetjs/runtime/id";
import { _resetIslandIds } from "../ids.ts";
import { calls } from "./fake-adapter.ts";
import { diagnosticsOf, page, scheduleOf, stateOf, type State } from "./harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Page = (props?: Record<string, unknown>) => ServerValue;

const source = `
import { signal } from "@rivetjs/reactivity";
import { _island } from "@rivetjs/bridge/server";
import { fake, fakeHead, Counter as CounterImpl, Card as CardImpl, Hoisting as HoistingImpl } from "./fake-adapter.ts";
const COUNTER = { id: "src/Counter.fake#default", c: CounterImpl, a: fake, chunk: "/c/counter-island.js" };
const CARD = { id: "src/Card.fake#default", c: CardImpl, a: fakeHead };
const HOIST = { id: "src/Hoist.fake#default", c: HoistingImpl, a: fake, head: (head) => <meta name="hoisted" content={head.title} /> };
const HOIST_NO_SINK = { id: "src/Hoist.fake#nosink", c: HoistingImpl, a: fake };
// Facade shape (T5 generates it): module-level loaders resume by reference (\_rMod); a JSX-returning component.
function loadCounter() { return import("/islands/counter.js"); }
function loadCard() { return import("/islands/card.js"); }
export function Counter(props) { return <>{_island(props, COUNTER, loadCounter)}</>; }
export function Card(props) { return <>{_island(props, CARD, loadCard)}</>; }
export function Hoist(props) { return <>{_island(props, HOIST)}</>; }
export function HoistNoSink(props) { return <>{_island(props, HOIST_NO_SINK)}</>; }
export function Static() {
  return <main><Counter count={1} client={undefined} /><Counter count={2} /></main>;
}
export function Policies({ policy, preload }) {
  return <main><Counter count={3} client={policy} preload={preload} persist="k" /></main>;
}
export function Live() {
  const n = signal(4);
  return <main><Counter count={n()} /><button onClick={() => n.set(n() + 1)}>+</button></main>;
}
export function Heads() {
  return <main><Card label="a" /><Card label="b" /><Hoist text="T" /></main>;
}
export function NoSink() {
  return <main><HoistNoSink text="U" /></main>;
}
export function LiveLoad() {
  const n = signal(4);
  return <main><Counter client="load" count={n()} /><button onClick={() => n.set(n() + 1)}>+</button></main>;
}
export function OnlyHead() {
  return <main><Card label="x" client="only" fallback={<i>wait</i>} /><Card label="y" /></main>;
}
export function Only() {
  return <main><Counter count={5} client="only" fallback={<i>loading</i>} /></main>;
}
`;
const { mod, manifest } = await page<Record<string, Page>>(source);
const dev = await page<Record<string, Page>>(source, { dev: true });
const render = (fn: Page, props?: Record<string, unknown>, m = manifest) => resumableToString(() => fn(props), { manifest: m }) as Promise<string>;
const EFFECT = /^@rivetjs\/bridge\/root\.tsx#_hydratedRoot\$/;

test("static island: wrapper with a per-render id, framework props only, nothing recorded (no state, no loader)", async () => {
  _resetIslandIds();
  calls.length = 0;
  const html = await render(mod.Static!);
  assert.equal(
    html,
    '<main><rivet-island data-ri="i0" style="display:contents"><div class="counter"><span>1</span></div></rivet-island>' +
      '<rivet-island data-ri="i1" style="display:contents"><div class="counter"><span>2</span></div></rivet-island></main>',
  );
  assert.deepEqual(
    calls.map((c) => c.props),
    [{ count: 1 }, { count: 2 }],
  );
  assert.deepEqual(calls[0]!.slots, []);
});

test("ids: one counter per id scope (restarts per request), process-wide outside any scope", async () => {
  const ids = (html: string) => [...html.matchAll(/data-ri="(i\d+)"/g)].map((m) => m[1]);
  _resetIslandIds();
  assert.deepEqual(ids(await render(mod.Static!)), ["i0", "i1"]);
  assert.deepEqual(ids(await render(mod.Static!)), ["i2", "i3"]);
  for (let i = 0; i < 2; i++) assert.deepEqual(ids(await withIdScope("rv", () => render(mod.Static!))), ["i0", "i1"]);
});

test("dev builds write data-rf (framework) / data-rc (policy); production writes only data-ri", async () => {
  const html = await render(dev.mod.Policies!, { policy: "visible" }, dev.manifest);
  assert.match(html, /<rivet-island data-ri="i\d+" data-rf="fake" data-rc="visible" style="display:contents" data-r="0">/);
  assert.doesNotMatch(await render(mod.Policies!, { policy: "visible" }), /data-r[fc]=/);
});

test("client policy: hydration effect (when) with load / root ref / framework props / options captured, island chunk preloaded", async () => {
  calls.length = 0;
  const cases: [policy: unknown, preload: string | undefined, when: string, code: string | undefined][] = [
    ["load", undefined, "load", "e"],
    ["idle", undefined, "idle", "i"],
    ["visible", undefined, "visible", "v"],
    ["interaction", undefined, "interaction", undefined],
    ["intent", undefined, "idle", undefined],
    ["media:(min-width: 800px)", undefined, "media:(min-width: 800px)", undefined],
    [{ on: "visible", rootMargin: "200px" }, "idle", "visible", "i"],
  ];
  for (const [policy, preload, when, code] of cases) {
    const html = await render(mod.Policies!, { policy, preload });
    const state = stateOf(html)!;
    const effects = state.fx.filter(([symbol]) => EFFECT.test(String((state.s as string[] | undefined)?.[Number(symbol)] ?? symbol)));
    assert.equal(state.fx.length, 1, JSON.stringify(policy));
    assert.equal(state.fx[0]![2], when);
    assert.ok(effects.length <= 1);
    assert.match(html, /<rivet-island data-ri="i\d+" style="display:contents" data-r="0"><div class="counter"><span>3<\/span><\/div><\/rivet-island>/);
    const entry = scheduleOf(html)?.find(([url]) => url === "/c/counter-island.js");
    assert.equal(entry?.[1], code, JSON.stringify(policy));
  }
  // Island-level props never reach the framework.
  assert.ok(calls.every((c) => !("client" in c.props) && !("preload" in c.props) && !("persist" in c.props)));
  // Options: the object form's extra keys + the island id.
  const html = await render(mod.Policies!, { policy: { on: "visible", rootMargin: "200px" } });
  assert.match(html, /"rootMargin":"200px"/);
  assert.match(html, /"on":"visible"/);
});

test("no client + a live prop: an idle hydrate-on-change effect, no chunk preload; static values record nothing", async () => {
  const html = await render(mod.Live!);
  const state = stateOf(html)!;
  assert.equal(state.fx.length, 1);
  assert.equal(state.fx[0]![2], "idle");
  assert.match(html, /<rivet-island data-ri="i\d+" style="display:contents" data-r="\d+"><div class="counter"><span>4<\/span>/);
  assert.equal(
    scheduleOf(html)?.find(([url]) => url === "/c/counter-island.js"),
    undefined,
  );
  assert.doesNotMatch(JSON.stringify(state), /"on":/);
  // The facade's `{_island(…)}` child records no binding over the props (a resumed page would re-create the island).
  assert.deepEqual(state.b, []);
  assert.deepEqual(stateOf(await render(mod.LiveLoad!))!.b, []);
  assert.equal(stateOf(await render(mod.Static!)), null);
});

test("head: the adapter's page-level head once per render (id scope), hoisted head entries through the def's sink", async () => {
  const html = await withIdScope("rv", () => render(mod.Heads!));
  assert.equal((html.match(/<script>fake\(/g) ?? []).length, 1);
  assert.match(html, /<main><script>fake\("i0"\)<\/script><rivet-island data-ri="i0"[^>]*><article id="i0-card">/);
  assert.match(html, /<meta name="hoisted" content="T"><rivet-island data-ri="i2" style="display:contents"><p>T<\/p><\/rivet-island>/);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    assert.match(await render(dev.mod.NoSink!, undefined, dev.manifest), /<p>U<\/p>/);
    assert.match(String(warn.mock.calls[0]?.[0]), /island src\/Hoist\.fake#nosink: head entries dropped/);
  } finally {
    warn.mockRestore();
  }
});

test('client="only": no server render; the fallback (Rivet content) stands in; the effect mounts at load', async () => {
  calls.length = 0;
  const html = await render(mod.Only!);
  assert.equal(calls.length, 0);
  assert.match(html, /<rivet-island data-ri="i\d+" style="display:contents" data-r="0"><i>loading<\/i><\/rivet-island>/);
  assert.equal(stateOf(html)!.fx[0]![2], "load");
});

test('client="only": no adapter page head (head belongs to server-rendered output); the next rendered island still gets it', async () => {
  const html = await withIdScope("rv", () => render(mod.OnlyHead!));
  assert.match(html, /^<main><rivet-island data-ri="i0"[^>]*><i>wait<\/i><\/rivet-island><script>fake\("i1"\)<\/script><rivet-island data-ri="i1"/);
  assert.equal((html.match(/<script>fake\(/g) ?? []).length, 1);
});

test("resume state: a live getter prop is a forwarding box over a resumable getter (the signal, not its value); a static prop is the value", async () => {
  const props = (state: State) => {
    const entry = state.t.find((e) => (e as { k?: unknown[] }).k?.[0] === "props") as { k: unknown[] };
    const out: Record<string, unknown> = {};
    for (let i = 1; i < entry.k.length; i += 2) out[state.t[entry.k[i] as number] as string] = state.t[entry.k[i + 1] as number];
    return out;
  };
  const live = stateOf(await render(mod.LiveLoad!))!;
  const count = props(live).count as { k: [string, number, number] };
  assert.equal(count.k[0], "m");
  const getter = live.t[count.k[2]] as { f?: number[] };
  assert.ok(Array.isArray(getter.f), "a resumable getter, not a value: " + JSON.stringify(getter));
  // The getter captures the signal (`{s}` entry holding 4).
  const signalAt = getter.f!.slice(1).find((i) => (live.t[i] as { s?: number }).s !== undefined)!;
  assert.equal(live.t[(live.t[signalAt] as { s: number }).s], 4);
  // Static values: the props object as plain JSON.
  assert.deepEqual(
    stateOf(await render(mod.Policies!, { policy: "load" }))!.t.find((e) => (e as { j?: { count?: number } }).j?.count !== undefined),
    { j: { count: 3 } },
  );
});

test("resume state never references the adapter or the island chunk: only the facade loader (by reference) and the props", async () => {
  for (const html of [await render(mod.LiveLoad!), await render(mod.Policies!, { policy: "load" }), await render(mod.Only!)]) {
    const state = JSON.stringify(stateOf(html));
    assert.doesNotMatch(state, /fake|CounterImpl|islands\/counter|counter-island/);
    assert.match(state, /#loadCounter\$[^"]*\$ref/);
  }
});

test("a non-serializable island prop is the standard resume capture diagnostic (RV2003)", () => {
  const diagnostics = diagnosticsOf(`
import { _island } from "@rivetjs/bridge/server";
const DEF = { id: "src/X.fake#default" };
function loadX() { return import("/islands/x.js"); }
function X(props) { return <>{_island(props, DEF, loadX)}</>; }
export function Page() { const cache = new WeakMap(); return <main><X client="load" cache={cache} /></main>; }
`);
  assert.deepEqual(
    diagnostics.map((d) => d.code),
    ["RV2003"],
  );
  assert.match(diagnostics[0]!.message, /cannot capture `cache`: class instances are not serializable/);
});

test("ctx.nonce: the Rivet render's CSP nonce (sanitised), undefined without one", async () => {
  calls.length = 0;
  await resumableToString(() => mod.Static!(), { manifest, nonce: 'n0"nce' });
  await render(mod.Static!);
  assert.deepEqual(
    calls.map((c) => c.ctx.nonce),
    ["n0nce", "n0nce", undefined, undefined],
  );
});
