// T6 React server adapter: renderToString fast path (inner HTML = React's own render, ids aside), slot holes the core
// splits, React 19 hoistables as the island's head, Suspense through renderToReadableStream (allReady), render errors
// (incl. inside Suspense) reject, CSP nonce + abort signal reach React, useId prefixed by the island id.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createElement, lazy } from "react";
import { renderToString } from "react-dom/server";
import { adapter } from "../server.ts";

/** Same pattern as `SUSPENDED` in ../server.ts (kept private there: 0 B): the text React throws today. */
const SUSPENDED = /suspended while responding to synchronous input/;
import type { IslandContext, IslandRender, SlotMark } from "@rivetjs/bridge/adapter";
import { AsyncNote, Boom, Card, Clock, Counter, Hoisting, LazyCard, RootUse, Suspending, SuspenseBoom } from "./fixtures/components.ts";

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

test("renderToString fast path: synchronous, React's own markup (ids aside), useId prefixed by the island id", () => {
  const html = render(Counter, { count: 3, label: "add" });
  assert.equal(typeof html, "string");
  assert.equal(noIds(html as string), noIds(renderToString(createElement(Counter, { count: 3, label: "add" }))));
  assert.match(html as string, /<div class="counter" id="_i0-R_[\w]+_">/);
  const ids = ["i0", "i1", "i2"].map((id) => /id="([^"]+)"/.exec(render(Counter, { count: 1 }, {}, ctx(id)) as string)![1]);
  assert.equal(new Set(ids).size, 3, ids.join(" "));
  // Class components render too.
  assert.equal(render(Clock, { at: "noon" }), "<time>noon</time>");
});

test("slots: one exact hole per slot (children = default, named content props by key), in React's output", () => {
  const html = render(Card, { tone: "warm" }, { default: mark("default"), title: mark("title") }) as string;
  assert.equal(
    html,
    '<article class="card warm"><h2><rivet-slot name="title" style="display:contents"></rivet-slot></h2><section><rivet-slot style="display:contents"></rivet-slot></section></article>',
  );
});

test("React 19 hoistables become the island's head (kit head fields); the island HTML keeps the content only", () => {
  const out = render(Hoisting, { text: "T" }) as IslandRender;
  assert.equal(out.html, '<div class="hoist">T</div>');
  assert.deepEqual(out.head, {
    title: "T & co",
    meta: [{ name: "description", content: "about T" }],
    links: [{ rel: "stylesheet", href: "/hoist.css" }],
  });
});

test("a suspending tree renders through the stream (allReady): resolved content, no fallback, no inline scripts", async () => {
  const out = render(Suspending, { value: "late" }, {}, ctx("i4", { nonce: "n0nce" }));
  assert.ok(out instanceof Promise);
  const html = (await out) as string;
  assert.equal(html, '<section><!--$--><b class="later">late</b><!--/$--></section>');
});

test("a root that suspends outside any Suspense boundary (root use(), lazy, async component) renders through the stream", async () => {
  for (const [component, props, expected] of [
    [RootUse, { value: "a" }, '<b class="later">root:a</b>'],
    [LazyCard, { title: "t" }, '<p class="lazy">t</p>'],
    [AsyncNote, { text: "n" }, '<i class="async">n</i>'],
  ] as const) {
    const out = render(component, props);
    assert.ok(out instanceof Promise, String(component));
    assert.equal(await out, expected);
  }
});

test("React's suspension message: renderToString still throws the text SUSPENDED keys on (a React upgrade must update it)", () => {
  // A fresh lazy (a resolved one renders synchronously), a new root promise, an async component.
  const pendingLazy = lazy(() => new Promise<never>(() => {}));
  for (const [name, component] of [
    ["root use()", RootUse],
    ["lazy", pendingLazy],
    ["async", AsyncNote],
  ] as const)
    assert.throws(() => renderToString(createElement(component as never, { value: "loud", text: "x" } as never)), SUSPENDED, name);
});

test("render errors reject: a throw (sync) and a throw inside a Suspense boundary (stream onError)", async () => {
  assert.throws(() => render(Boom, { message: "sync boom" }), /sync boom/);
  const out = render(SuspenseBoom, { message: "boundary boom" });
  assert.ok(out instanceof Promise);
  await assert.rejects(out as Promise<unknown>, /boundary boom/);
});

test("the island's abort signal aborts React's stream render", async () => {
  const abort = new AbortController();
  const out = render(Suspending, { value: "never", ms: 10_000 }, {}, ctx("i5", { signal: abort.signal }));
  abort.abort(new Error("request gone"));
  await assert.rejects(out as Promise<unknown>);
});

test("through the island core: the root wraps React's HTML, Rivet slot content fills the holes, hoisted head reaches the sink", async () => {
  const { page } = await import("../../bridge/tests/harness.ts");
  const { resumableToString } = await import("@rivetjs/runtime/server-resume");
  const source = `
import { _island } from "@rivetjs/bridge/server";
import { adapter } from "REACT";
import { Card as CardImpl, Hoisting as HoistingImpl } from "FIXTURES";
const CARD = { id: "src/Card.react.tsx#Card", c: CardImpl, a: adapter };
const HOIST = { id: "src/Hoist.react.tsx#Hoisting", c: HoistingImpl, a: adapter, head: (head) => <meta name="sink" content={head.title} /> };
export function Card(props) { return <>{_island(props, CARD)}</>; }
export function Hoisting(props) { return <>{_island(props, HOIST)}</>; }
export function Page() {
  return <main><Card tone="cool" title={<em>Hi</em>}><button>rivet</button></Card><Hoisting text="H" /></main>;
}
`;
  const { mod, manifest } = await page<{ Page: () => never }>(source, {
    links: { REACT: new URL("../server.ts", import.meta.url).href, FIXTURES: new URL("./fixtures/components.ts", import.meta.url).href },
  });
  const html = (await resumableToString(() => mod.Page(), { manifest })) as string;
  assert.match(
    html,
    /<rivet-island data-ri="i\d+" style="display:contents"><article class="card cool"><h2><rivet-slot name="title" style="display:contents"><em>Hi<\/em><\/rivet-slot><\/h2><section><rivet-slot style="display:contents"><button>rivet<\/button><\/rivet-slot><\/section><\/article><\/rivet-island>/,
  );
  assert.match(
    html,
    /<meta name="sink" content="H &amp; co"\/?><rivet-island data-ri="i\d+" style="display:contents"><div class="hoist">H<\/div><\/rivet-island>/,
  );
});
