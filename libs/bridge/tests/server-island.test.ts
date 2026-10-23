// T3 `_island` server on the derived model: wrapper + per-request ids, policy props stripped, dev attributes, lean island
// records (`rivet/islands` + chunk closure), page-level adapter head, hoisted head, `client="only"`.
import { test, vi } from "vitest";
import assert from "node:assert/strict";
import { resumableToString, type ResumeManifest } from "@rivetjs/runtime/server-resume";
import { withIdScope } from "@rivetjs/runtime/id";
import { _resetIslandIds } from "../ids.ts";
import { calls } from "./fake-adapter.ts";
import { islandsOf, page, tailOf } from "./harness.ts";

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
const ISLAND = "/c/counter-island.js";
const withIslands = (m: Awaited<ReturnType<typeof page>>["manifest"]) => ({
  ...m,
  islands: { "src/Counter.fake#default": ISLAND },
  deps: { [ISLAND]: ["/c/vendor.js"] },
});
const built = await page<Record<string, Page>>(source);
const dev = await page<Record<string, Page>>(source, { dev: true });
const { mod } = built;
const manifest = withIslands(built.manifest);
const render = (fn: Page, props?: Record<string, unknown>, m: ResumeManifest = manifest) =>
  resumableToString(() => fn(props), { manifest: m }) as Promise<string>;

test("static island: wrapper with a per-render id, framework props only, nothing recorded (no tail, no loader)", async () => {
  _resetIslandIds();
  calls.length = 0;
  const html = await render(mod.Static!);
  assert.equal(
    html,
    '<main><!--[--><rivet-island data-ri="i0" style="display:contents"><div class="counter"><span>1</span></div></rivet-island><!--]-->' +
      '<!--[--><rivet-island data-ri="i1" style="display:contents"><div class="counter"><span>2</span></div></rivet-island><!--]--></main>',
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
  const html = await render(dev.mod.Policies!, { policy: "visible" }, withIslands(dev.manifest));
  assert.match(html, /<rivet-island data-ri="i\d+" data-rf="fake" data-rc="visible" style="display:contents">/);
  assert.doesNotMatch(await render(mod.Policies!, { policy: "visible" }), /data-r[fc]=/);
});

test("client policy, plain JSON props: a lean island record (id, chunk, props, policy, chunk closure when prefetched), no Rivet runtime", async () => {
  calls.length = 0;
  const cases: [policy: unknown, on: string, closure: boolean][] = [
    ["load", "load", true],
    ["idle", "idle", true],
    ["visible", "visible", true],
    ["interaction", "interaction", false],
    ["media:(min-width: 800px)", "media:(min-width: 800px)", false],
    [{ on: "visible", rootMargin: "200px" }, "visible", true],
  ];
  for (const [policy, on, closure] of cases) {
    _resetIslandIds();
    const html = await render(mod.Policies!, { policy });
    const record = ["i0", ISLAND, { count: 3 }, on, ...(closure ? [[ISLAND, "/c/vendor.js"]] : [])];
    assert.deepEqual(islandsOf(html), [record], JSON.stringify(policy));
    assert.equal(tailOf(html), null, "no boundaries tail: " + JSON.stringify(policy));
    assert.match(html, /<rivet-island data-ri="i0" style="display:contents"><div class="counter"><span>3<\/span><\/div><\/rivet-island>/);
  }
  // Island-level props never reach the framework.
  assert.ok(calls.every((c) => !("client" in c.props) && !("preload" in c.props) && !("persist" in c.props)));
  // `intent` (cold-event replay) is never lean.
  assert.equal(islandsOf(await render(mod.Policies!, { policy: "intent" })), null);
});

test("no client policy or no chunk in the manifest: no lean record", async () => {
  assert.equal(islandsOf(await render(mod.Static!)), null);
  assert.equal(islandsOf(await render(mod.Policies!, { policy: "load" }, built.manifest)), null);
});

test("head: the adapter's page-level head once per render (id scope), hoisted head entries through the def's sink", async () => {
  const html = await withIdScope("rv", () => render(mod.Heads!));
  assert.equal((html.match(/<script>fake\(/g) ?? []).length, 1);
  assert.match(html, /<main><!--\[--><script>fake\("i0"\)<\/script><rivet-island data-ri="i0"[^>]*><article id="i0-card">/);
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
  assert.match(html, /<rivet-island data-ri="i\d+" style="display:contents"><i>loading<\/i><\/rivet-island>/);
  assert.equal(islandsOf(html)?.[0]?.[3], "only");
});

test('client="only": no adapter page head (head belongs to server-rendered output); the next rendered island still gets it', async () => {
  const html = await withIdScope("rv", () => render(mod.OnlyHead!));
  assert.match(
    html,
    /^<main><!--\[--><rivet-island data-ri="i0"[^>]*><i>wait<\/i><\/rivet-island><!--\]--><!--\[--><script>fake\("i1"\)<\/script><rivet-island data-ri="i1"/,
  );
  assert.equal((html.match(/<script>fake\(/g) ?? []).length, 1);
});

test("the boundaries tail never references the adapter or the island chunk", async () => {
  const html = await render(mod.LiveLoad!);
  const tail = JSON.stringify(tailOf(html));
  assert.match(tail, /src\/page\.tsx#LiveLoad/);
  assert.doesNotMatch(tail, /fake|CounterImpl|islands\/counter|counter-island/);
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
