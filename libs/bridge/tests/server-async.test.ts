// T3 async island renders: an Async boundary — awaited in place in ordered renders and under a streaming Suspense (the
// derived model awaits Suspense content on the server; the island's lean record follows), request abort through
// `ctx.signal`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderResumable, resumableToString } from "@rivetjs/runtime/server-resume";
import { aborted } from "./fake-adapter.ts";
import { islandsOf, page, tailOf } from "./harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Page = (props?: Record<string, unknown>) => ServerValue;

const source = `
import { signal } from "@rivetjs/reactivity";
import { Suspense } from "@rivetjs/runtime/server";
import { _island } from "@rivetjs/bridge/server";
import { fake, Later as LaterImpl, Hang as HangImpl } from "./fake-adapter.ts";
const LATER = { id: "src/Later.fake#default", c: LaterImpl, a: fake, chunk: "/c/later-island.js" };
const HANG = { id: "src/Hang.fake#default", c: HangImpl, a: fake };
function loadLater() { return import("/islands/later.js"); }
export function Later(props) { return <>{_island(props, LATER, loadLater)}</>; }
export function Hang(props) { return <>{_island(props, HANG)}</>; }
export function Awaited() {
  const n = signal(0);
  return <main><Later text="late" ms={5}><button onClick={() => n.set(1)}>{n()}</button></Later></main>;
}
export function Streamed() {
  const n = signal(0);
  return <main>
    <h1 onClick={() => n.set(n() + 1)}>{n()}</h1>
    <Suspense fallback={() => <i>wait</i>}>{() => <Later text="streamed" ms={10} client="visible" />}</Suspense>
  </main>;
}
export function Hanging() { return <main><Hang /></main>; }
`;
const built = await page<Record<string, Page>>(source);
const { mod } = built;
const manifest = { ...built.manifest, islands: { "src/Later.fake#default": "/c/later.js" } };

test("async render, ordered render: awaited in place; the slot content's boundary stays resumable", async () => {
  const html = (await resumableToString(() => mod.Awaited!(), { manifest })) as string;
  assert.match(
    html,
    /<main data-b="1"><!--\[--><rivet-island data-ri="i\d+" style="display:contents"><p>late<\/p><rivet-slot style="display:contents"><button>0<\/button>/,
  );
  assert.deepEqual(
    tailOf(html)!.b.map((record) => record[3]),
    ["src/page.tsx#Awaited"],
  );
});

test("async render inside a streaming Suspense: awaited in place (no fallback first), the island's lean record after it", async () => {
  const chunks: string[] = [];
  await renderResumable(() => mod.Streamed!(), { write: (chunk) => void chunks.push(chunk) }, { manifest, stream: {} });
  const html = chunks.join("");
  assert.doesNotMatch(html, /<i>wait<\/i>/);
  assert.match(html, /<!--\[--><rivet-island data-ri="(i\d+)" style="display:contents"><p>streamed<\/p><\/rivet-island><!--\]--><\/main>/);
  const records = islandsOf(html)!;
  assert.equal(records.length, 1);
  assert.equal(records[0]![3], "visible");
});

test("request abort reaches a pending async render through ctx.signal", async () => {
  aborted.length = 0;
  const controller = new AbortController();
  const done = resumableToString(() => mod.Hanging!(), { manifest, signal: controller.signal });
  await new Promise((resolve) => setTimeout(resolve, 5));
  controller.abort(new Error("gone"));
  await assert.rejects(Promise.resolve(done));
  assert.equal(aborted.length, 1);
  assert.match(String((aborted[0] as Error).message), /gone/);
});
