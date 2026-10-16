// T7b islands-only lean tail: a page whose only resumables are framework islands with plain-value props ends with
// the island records + the inline lean boot (no state script, no resume loader); anything else keeps the full tail,
// decided per render (same route, different props → different tails); dev logs why; the generated boot is current.
import { test, vi } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { _resetIslandIds } from "../ids.ts";
import { BOOT } from "../boot.min.ts";
import { minifiedBoot } from "../build-boot.ts";
import { page, stateOf } from "./harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Page = (props?: Record<string, unknown>) => ServerValue;

const source = `
import { computed, signal, untrack } from "@rivetjs/reactivity";
import { createStore, read } from "@rivetjs/reactivity/store";
import { _island } from "@rivetjs/bridge/server";
import { clientEvent } from "@rivetjs/runtime/dom";
import { fake, Counter as CounterImpl } from "./fake-adapter.ts";
const COUNTER = { id: "src/Counter.fake#default", c: CounterImpl, a: fake, chunk: "src/Counter.fake#default" };
function loadCounter() { return import("/islands/counter.js"); }
export function Counter(props) { return <>{_island(props, COUNTER, loadCounter)}</>; }
export function Islands() {
  return <main><h1>static</h1><Counter client="load" count={1} /><Counter client="idle" count={2} data={{ a: [1, "x", null, true] }} /><Counter client="visible" count={3} /><Counter count={4} /></main>;
}
export function Props({ date }) {
  const when = date ? new Date(0) : "1970-01-01";
  return <main><Counter client="load" count={5} when={when} /></main>;
}
const ROWS = [{ v: 1 }, { v: 2 }];
const label = (n) => "n=" + n;
export function Computed() {
  return <main><Counter client="visible" count={label(1)} values={ROWS.map((r) => r.v)} /></main>;
}
export function ViaComputed() {
  const n = signal(2);
  const double = computed(() => n() * 2);
  return <main><Counter client="load" count={double()} /></main>;
}
export function ViaStore() {
  const store = createStore({ a: { b: 1 } });
  return <main><Counter client="load" count={read(store, "a.b")} /></main>;
}
const epoch = () => new Date(0);
const picker = () => () => 1;
export function DateGetter() {
  return <main><Counter client="load" count={1} when={epoch()} /></main>;
}
export function FunctionGetter() {
  return <main><Counter client="load" count={1} pick={picker()} /></main>;
}
export function Untracked() {
  const n = signal(7);
  return <main><Counter client="load" count={untrack(n)} /></main>;
}
export function Live() {
  const n = signal(5);
  return <main><Counter client="load" count={n()} /></main>;
}
export function Callback() {
  return <main><Counter client="load" count={1} onPick={() => 1} /></main>;
}
export function Slot() {
  return <main><Counter client="load" count={1}><b>rivet</b></Counter></main>;
}
export function Intent() {
  return <main><Counter client="intent" count={1} /></main>;
}
export function NotPlain() {
  return <main><Counter client="load" count={1} when={new Date(0)} /></main>;
}
export function Mixed() {
  const n = signal(1);
  return <main><Counter client="load" count={1} /><button onClick={() => n.set(n() + 1)}>{n()}</button></main>;
}
export function Nav() {
  clientEvent(document, "click", () => 1, { preload: "intent", match: "a" });
  clientEvent(document, "focusin", () => 2, { preload: "intent", match: "a" });
  return <main><a href="/next">next</a><Counter client="load" count={1} /><Counter client="idle" count={2} /></main>;
}
export function EagerNav() {
  clientEvent(document, "click", () => 1, { match: "a" });
  return <main><Counter client="load" count={1} /></main>;
}
export function Policies() {
  return <main><Counter client="interaction" count={1} /><Counter client="media:(min-width: 1px)" count={2} /><Counter client="only" count={3} fallback={<i>wait</i>} /></main>;
}
`;
const { mod, manifest: base } = await page<Record<string, Page>>(source);
const dev = await page<Record<string, Page>>(source, { dev: true });
const URL_ = "/c/counter-island.js";
const manifest = { ...base, islands: { "src/Counter.fake#default": URL_ }, deps: { [URL_]: ["/c/vendor.js"] } };
const render = (fn: Page, props?: Record<string, unknown>, options: Record<string, unknown> = {}) => {
  _resetIslandIds();
  return resumableToString(() => fn(props), { manifest, ...options } as never) as Promise<string>;
};
const records = (html: string) => {
  const json = /<script type="rivet\/islands"[^>]*>(.*?)<\/script>/s.exec(html)?.[1];
  return json ? JSON.parse(json) : null;
};
const lean = (html: string) => records(html) !== null && stateOf(html) === null && !html.includes("data-ld=");

test("islands-only page: island records + inline boot, no link tags / state script / loader", async () => {
  const html = await render(mod.Islands!);
  assert.ok(lean(html), html);
  assert.deepEqual(records(html), [
    ["i0", URL_, { count: 1 }, "load", [URL_, "/c/vendor.js"]],
    ["i1", URL_, { count: 2, data: { a: [1, "x", null, true] } }, "idle", [URL_, "/c/vendor.js"]],
    ["i2", URL_, { count: 3 }, "visible", [URL_, "/c/vendor.js"]],
  ]);
  // The static island (no client) is not a record. No modulepreload tags: the boot preloads every record's closure
  // (chunk + its static imports) after the first paint entry, off Lighthouse's simulated FCP / LCP path.
  const tail = html.slice(html.indexOf("</main>") + 7);
  assert.equal(tail, `<script type="rivet/islands">${JSON.stringify(records(html))}</script><script>${BOOT}</script>`);
});

test("computed getter props that read no signal are static: sent as their values (lean tail)", async () => {
  const html = await render(mod.Computed!);
  assert.ok(lean(html), html);
  assert.deepEqual(records(html), [["i0", URL_, { count: "n=1", values: [1, 2] }, "visible", [URL_, "/c/vendor.js"]]]);
});

test("getter props: a signal read through a computed or a store path keeps the full driver; a Date / function result too", async () => {
  for (const name of ["ViaComputed", "ViaStore", "DateGetter", "FunctionGetter"]) {
    const html = await render(mod[name]!);
    assert.ok(!lean(html) && stateOf(html) !== null, name + ": " + html);
  }
});

test("caveat: a read inside untrack() is invisible to the getter check — sent as a constant (lean tail)", async () => {
  const html = await render(mod.Untracked!);
  assert.ok(lean(html), html);
  assert.deepEqual(records(html), [["i0", URL_, { count: 7 }, "load", [URL_, "/c/vendor.js"]]]);
});

test("other policies: interaction / media / only are lean records (only: preloaded by the boot, no link tags)", async () => {
  const html = await render(mod.Policies!);
  assert.ok(lean(html), html);
  assert.deepEqual(
    records(html).map((r: unknown[]) => r[3]),
    ["interaction", "media:(min-width: 1px)", "only"],
  );
  assert.equal(records(html)[2][4]?.length, 2);
  assert.ok(!html.includes("<link"), html);
});

test("decided per render: the same route takes the full tail for a non-JSON prop value, the lean tail for JSON", async () => {
  const full = await render(mod.Props!, { date: true });
  assert.ok(!lean(full) && stateOf(full) !== null && records(full) === null, full);
  const plain = await render(mod.Props!, { date: false });
  assert.ok(lean(plain), plain);
  assert.deepEqual(records(plain), [["i0", URL_, { count: 5, when: "1970-01-01" }, "load", [URL_, "/c/vendor.js"]]]);
  // Deterministic: the same props give the same tail again.
  assert.equal(await render(mod.Props!, { date: false }), plain);
  assert.equal(await render(mod.Props!, { date: true }), full);
});

test("full tail: callbacks, Rivet slot content, intent, non-JSON props, Rivet resumables, no manifest chunk", async () => {
  for (const name of ["Live", "Callback", "Slot", "Intent", "NotPlain", "Mixed"]) {
    const html = await render(mod[name]!);
    assert.ok(!lean(html) && stateOf(html) !== null, name + ": " + html);
  }
  _resetIslandIds();
  const bare = (await resumableToString(() => mod.Islands!(), { manifest: base })) as string;
  assert.ok(!lean(bare) && stateOf(bare) !== null, bare);
});

test("D-lean: intent client events (a router's link listeners) → lean islands + a deferred state that does not boot", async () => {
  const html = await render(mod.Nav!);
  assert.deepEqual(records(html), [
    ["i0", URL_, { count: 1 }, "load", [URL_, "/c/vendor.js"]],
    ["i1", URL_, { count: 2 }, "idle", [URL_, "/c/vendor.js"]],
  ]);
  const state = stateOf(html)!;
  assert.ok(state, html);
  // The islands' hydration effects stay out of the state: the lean boot hydrates them, a later runtime boot must not.
  assert.deepEqual(state.fx, []);
  assert.equal(state.ce.length, 2);
  const tag = /<script type="rivet\/state"[^>]*>/.exec(html)![0];
  // Not booted at load, no fetch-ahead, no schedule: the loader starts the runtime on the first link intent / click.
  assert.ok(!tag.includes("data-boot") && !tag.includes("data-fo") && !tag.includes("data-preload"), tag);
  assert.match(tag, /data-events="[^"]*click/);
  // Order: lean records + boot, then the state script + loader (the loader binds to the script right before it).
  const at = (needle: string) => html.indexOf(needle);
  assert.ok(at('type="rivet/islands"') < at(BOOT) && at(BOOT) < at('type="rivet/state"'), html);
});

test("D-lean + preload.ahead: the deferred state keeps the runtime fetch-ahead (data-fo), still no boot / schedule", async () => {
  const tagOf = (html: string) => /<script type="rivet\/state"[^>]*>/.exec(html)![0];
  const withLoader = { ...manifest, loader: "/c/loader.js" };
  const ahead = tagOf(await render(mod.Nav!, undefined, { manifest: withLoader, preload: { ahead: true } }));
  assert.match(ahead, /data-fo="\/rt\.js [^"]+"/);
  assert.ok(!ahead.includes("data-boot") && !ahead.includes("data-preload"), ahead);
  // Without `ahead`, or with `lean` (it wins): no fetch-ahead.
  for (const preload of [undefined, { ahead: true, lean: true }]) {
    const tag = tagOf(await render(mod.Nav!, undefined, { manifest: withLoader, ...(preload ? { preload } : {}) }));
    assert.ok(!tag.includes("data-fo"), tag);
  }
});

test("D-lean: an eager client event boots the runtime at load → full tail, unchanged", async () => {
  const html = await render(mod.EagerNav!);
  assert.ok(records(html) === null && stateOf(html) !== null, html);
  assert.match(/<script type="rivet\/state"[^>]*>/.exec(html)![0], /data-boot/);
});

test("CSP nonce on every lean tail element", async () => {
  const html = await render(mod.Islands!, undefined, { nonce: "n0nce" });
  assert.equal(html.match(/nonce="n0nce"/g)?.length, 2);
});

test("dev: one log line naming what kept the full driver (deduplicated)", async () => {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  try {
    const run = (fn: Page, props?: Record<string, unknown>) => {
      _resetIslandIds();
      return resumableToString(() => fn(props), { manifest } as never) as Promise<string>;
    };
    await run(dev.mod.Callback!);
    await run(dev.mod.Callback!);
    await run(dev.mod.Live!);
    await run(dev.mod.Mixed!);
    await run(dev.mod.Slot!);
    for (const name of ["ViaComputed", "ViaStore", "DateGetter", "FunctionGetter"]) await run(dev.mod[name]!);
    await run(dev.mod.EagerNav!);
    const lines = info.mock.calls.map((c) => String(c[0]));
    assert.deepEqual(lines, [
      '[rivet:bridge] full resume driver for this page: island i0 (src/Counter.fake#default): prop "onPick" is a function (callback)',
      '[rivet:bridge] full resume driver for this page: island i0 (src/Counter.fake#default): prop "count" is live (reads a signal)',
      "[rivet:bridge] full resume driver for this page: the page has Rivet resumables (1 element(s) with handlers / bindings, 1 text binding(s))",
      '[rivet:bridge] full resume driver for this page: island i0 (src/Counter.fake#default): slot "default" holds Rivet content',
      // ViaComputed and ViaStore: the same reason (deduplicated).
      '[rivet:bridge] full resume driver for this page: island i0 (src/Counter.fake#default): prop "when" is not a plain JSON value',
      '[rivet:bridge] full resume driver for this page: island i0 (src/Counter.fake#default): prop "pick" is a function (callback)',
      "[rivet:bridge] full resume driver for this page: the page has Rivet resumables that boot at load (0 region(s), 1 client event(s))",
    ]);
    // Production builds never log.
    info.mockClear();
    await render(mod.Callback!);
    assert.equal(info.mock.calls.length, 0);
  } finally {
    info.mockRestore();
  }
});

test("boot.min.ts is current (node libs/bridge/build-boot.ts)", async () => {
  assert.equal(BOOT, await minifiedBoot());
});
