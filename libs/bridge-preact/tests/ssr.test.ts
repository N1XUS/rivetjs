// T8 Preact server adapter: renderToString fast path (Preact's own markup, ids aside), useId masked by the island id,
// slot holes the core splits, a suspending tree through renderToStringAsync, render errors reject.
import { test } from "vitest";
import assert from "node:assert/strict";
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import type { IslandContext, SlotMark } from "@rivetjs/bridge/adapter";
import { adapter } from "../server.ts";
import { Boom, Card, Clock, Counter, LazyCard, RootLater, SuspenseBoom, Suspending, Titled } from "./fixtures/components.ts";

/** Same pattern as `SUSPENDED` in ../server.ts: the text preact-render-to-string throws today. */
const SUSPENDED = /renderToStringAsync/;

const mark = (name: string): SlotMark => ({
  name,
  html: "<rivet-slot" + (name === "default" ? "" : ` name="${name}"`) + ' style="display:contents"></rivet-slot>',
});
const ctx = (id = "i0", extra: Partial<IslandContext> = {}): IslandContext => ({
  id,
  nonce: undefined,
  signal: new AbortController().signal,
  slot: mark,
  ...extra,
});
const render = (component: unknown, props: Record<string, unknown>, slots: Record<string, SlotMark> = {}, c = ctx()) =>
  adapter.render(component as never, props, slots, c);
const noIds = (html: string) => html.replace(/ id="[^"]*"/g, "");

test("renderToString fast path: synchronous, Preact's own markup (ids aside); useId masked by the island id", () => {
  const html = render(Counter, { count: 3, label: "add" });
  assert.equal(typeof html, "string");
  assert.equal(noIds(html as string), noIds(renderToString(h(Counter, { count: 3, label: "add" }))));
  assert.match(html as string, /<div id="Pi0-0" class="counter">/);
  const ids = ["i0", "i1", "i2"].map((id) => /id="([^"]+)"/.exec(render(Counter, { count: 1 }, {}, ctx(id)) as string)![1]);
  assert.deepEqual(ids, ["Pi0-0", "Pi1-0", "Pi2-0"]);
  assert.equal(render(Clock, { at: "noon" }), "<time>noon</time>");
});

test("slots: one exact hole per slot (children = default, named content props by key), in Preact's output", () => {
  const html = render(Card, { tone: "warm" }, { default: mark("default"), title: mark("title") }) as string;
  assert.equal(
    html,
    '<article class="card warm"><h2><rivet-slot name="title" style="display:contents"></rivet-slot></h2><section><rivet-slot style="display:contents"></rivet-slot></section></article>',
  );
});

test("a suspending tree (Suspense, a root that suspends, lazy) renders through renderToStringAsync: resolved content", async () => {
  for (const [component, props, expected] of [
    [Suspending, { value: "late" }, '<section><!--$s--><b class="later">late</b><!--/$s--></section>'],
    // A suspension outside any boundary gets preact-render-to-string's own suspense markers.
    [RootLater, { value: "a" }, '<!--$s--><b class="later">root:a</b><!--/$s-->'],
    [LazyCard, { title: "t" }, '<!--$s--><p class="lazy">t</p><!--/$s-->'],
  ] as const) {
    const out = render(component, props);
    assert.ok(out instanceof Promise, String(component));
    assert.equal(await out, expected);
  }
});

test("suspension message: renderToString still throws the text SUSPENDED keys on (an upgrade must update it)", () => {
  assert.throws(() => renderToString(h(Suspending, { value: "loud", ms: 10_000 })), SUSPENDED);
});

test("render errors reject (sync throw)", () => {
  assert.throws(() => render(Boom, { message: "sync boom" }), /sync boom/);
});

test("an error inside a Suspense boundary rejects through renderToStringAsync", async () => {
  const out = render(SuspenseBoom, { message: "late boom" });
  assert.ok(out instanceof Promise);
  await assert.rejects(out as Promise<unknown>, /late boom/);
});

test("no island head: a Preact <title> / <meta> renders inline in the island (Preact has no hoistables)", () => {
  assert.equal(render(Titled, { title: "T" }), '<div class="titled"><title>T</title><meta name="x" content="y"/></div>');
});

test("useId mask probe (RV2150): the installed Preact reads the island mask, the adapter renders", () => {
  // The probe ran on the first render above; a moved mask field would make every render throw `[RV2150] …`.
  assert.doesNotThrow(() => render(Counter, { count: 0 }));
  assert.match(String(render(Counter, { count: 0 }, {}, ctx("i9"))), /id="Pi9-0"/);
});

test("through the island core: the root wraps Preact's HTML, Rivet slot content fills the holes", async () => {
  const { page } = await import("../../bridge/tests/harness.ts");
  const { resumableToString } = await import("@rivetjs/runtime/server-resume");
  const source = `
import { _island } from "@rivetjs/bridge/server";
import { adapter } from "PREACT";
import { Card as CardImpl } from "FIXTURES";
const CARD = { id: "src/Card.preact.tsx#Card", c: CardImpl, a: adapter };
export function Card(props) { return <>{_island(props, CARD)}</>; }
export function Page() {
  return <main><Card tone="cool" title={<em>Hi</em>}><button>rivet</button></Card></main>;
}
`;
  const { mod, manifest } = await page<{ Page: () => never }>(source, {
    links: { PREACT: new URL("../server.ts", import.meta.url).href, FIXTURES: new URL("./fixtures/components.ts", import.meta.url).href },
  });
  const html = (await resumableToString(() => mod.Page(), { manifest })) as string;
  assert.match(
    html,
    /<rivet-island data-ri="i\d+" style="display:contents"><article class="card cool"><h2><rivet-slot name="title" style="display:contents"><em>Hi<\/em><\/rivet-slot><\/h2><section><rivet-slot style="display:contents"><button>rivet<\/button><\/rivet-slot><\/section><\/article><\/rivet-island>/,
  );
});
