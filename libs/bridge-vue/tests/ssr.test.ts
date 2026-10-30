import { test } from "vitest";
import assert from "node:assert/strict";
import type { IslandContext, SlotMark } from "@rivetjs/bridge/adapter";
import { adapter, createAdapter } from "../server.ts";
import { AsyncBoom, AsyncCard, Boom, Card, Counter, Head, Injected } from "./fixtures/components.ts";

const mark = (name: string): SlotMark => ({
  name,
  html: "<rivet-slot" + (name === "default" ? "" : ` name="${name}"`) + ' style="display:contents"></rivet-slot>',
});
const ctx = (id = "i0"): IslandContext => ({ id, nonce: undefined, signal: new AbortController().signal, slot: mark });

test("async SSR: public idPrefix creates stable unique IDs per island", async () => {
  for (const id of ["i0", "i1", "i2"]) {
    const result = adapter.render(Counter, { count: 3 }, {}, ctx(id));
    assert.ok(result instanceof Promise);
    assert.match((await result) as string, new RegExp(`id="${id}-0"`));
  }
});
test("default and kebab-case named slots emit exact protocol holes", async () => {
  const html = await adapter.render(Card, { tone: "warm" }, { default: mark("default"), "section-title": mark("section-title") }, ctx());
  assert.equal(
    html,
    '<article class="warm"><header><rivet-slot name="section-title" style="display:contents"></rivet-slot></header><section><rivet-slot style="display:contents"></rivet-slot></section></article>',
  );
});
test("async setup resolves before the island completes", async () => {
  assert.equal(await adapter.render(AsyncCard, {}, {}, ctx()), "<b>resolved</b>");
});
test("sync and async component errors reject", async () => {
  await assert.rejects(Promise.resolve(adapter.render(Boom, {}, {}, ctx())), /vue boom/);
  await assert.rejects(Promise.resolve(adapter.render(AsyncBoom, {}, {}, ctx())), /vue async boom/);
});
test("setup(app) runs per island and installs isolated app context", async () => {
  let sequence = 0;
  const configured = createAdapter({
    setup(app) {
      app.use({
        install(app) {
          app.provide("value", ++sequence);
        },
      });
    },
  });
  assert.equal(await configured.render(Injected, {}, {}, ctx()), "<b>1</b>");
  assert.equal(await configured.render(Injected, {}, {}, ctx()), "<b>2</b>");
});
test("head teleports become head entries and never duplicate in island body", async () => {
  const result = await adapter.render(Head, {}, {}, ctx());
  assert.equal(typeof result, "object");
  assert.deepEqual((result as { head: unknown }).head, { title: "Vue & Rivet", meta: [{ name: "description", content: "island" }] });
  assert.match((result as { html: string }).html, /<p>body<\/p>/);
  assert.doesNotMatch((result as { html: string }).html, /<title>|<meta/);
});

test("through Rivet: resumable slot holes, async Suspense content and error fallbacks", async () => {
  const { page } = await import("../../bridge/tests/harness.ts");
  const { resumableToString, renderResumable } = await import("@rivetjs/runtime/server-resume");
  const source = `
import { Suspense } from "@rivetjs/runtime/server";
import { _island } from "@rivetjs/bridge/server";
import { adapter } from "VUE";
import { Card as CardImpl, AsyncCard as AsyncImpl, Boom as BoomImpl } from "FIXTURES";
const CARD = { id: "src/Card.vue#default", c: CardImpl, a: adapter };
const ASYNC = { id: "src/Async.vue#default", c: AsyncImpl, a: adapter };
const BOOM = { id: "src/Boom.vue#default", c: BoomImpl, a: adapter };
function Card(props) { return <>{_island(props, CARD)}</>; }
function Later(props) { return <>{_island(props, ASYNC)}</>; }
function Fails(props) { return <>{_island(props, BOOM)}</>; }
export function Page() { return <main><Card tone="warm" section-title={<em>heading</em>}><button>Rivet</button></Card><Fails fallback={<i>fallback</i>} /></main>; }
export function Stream() { return <main><Suspense fallback={() => <i>wait</i>}>{() => <Later />}</Suspense></main>; }
`;
  type Page = () => ReturnType<Parameters<typeof resumableToString>[0]>;
  const { mod, manifest } = await page<{ Page: Page; Stream: Page }>(source, {
    links: { VUE: new URL("../server.ts", import.meta.url).href, FIXTURES: new URL("./fixtures/components.ts", import.meta.url).href },
  });
  const html = (await resumableToString(() => mod.Page(), { manifest })) as string;
  assert.match(html, /<rivet-slot name="section-title" style="display:contents"><em>heading<\/em><\/rivet-slot>/);
  assert.match(html, /<rivet-slot style="display:contents"><button>Rivet<\/button><\/rivet-slot>/);
  assert.match(html, /<i>fallback<\/i>/);
  const chunks: string[] = [];
  await renderResumable(() => mod.Stream(), { write: (chunk) => void chunks.push(chunk) }, { manifest, stream: {} });
  const streamed = chunks.join("");
  assert.match(streamed, /<i>wait<\/i>/);
  assert.match(streamed, /<template data-s="\d+"><rivet-island[^>]*><b>resolved<\/b><\/rivet-island><\/template>/);
});

test("head teleports retain their exact native target anchors in server-only per-island metadata", async () => {
  const result = (await adapter.render(Head, {}, {}, ctx("i7"))) as { head: object };
  const descriptor = Object.getOwnPropertyDescriptor(result.head, Symbol.for("rivet.head.render"));
  assert.ok(descriptor, "native head callback exists");
  assert.equal(descriptor.enumerable, false);
  assert.match(descriptor.value.render(), /^<!--rivet-head:vue:i7--><!--teleport start anchor-->/);
  assert.match(descriptor.value.render(), /<!--teleport anchor--><!--\/rivet-head:vue:i7-->$/);
  assert.doesNotMatch(JSON.stringify(result), /rivet-head|teleport start anchor/);
});
