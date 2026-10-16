// T3 async island renders: an Async boundary — awaited in ordered renders, streamed as a segment by a streaming
// Suspense above it (the segment's patch carries the island's hydration effect), request abort through `ctx.signal`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderResumable, resumableToString } from "@rivetjs/runtime/server-resume";
import { aborted } from "./fake-adapter.ts";
import { page, stateOf } from "./harness.ts";

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
const { mod, manifest } = await page<Record<string, Page>>(source);

test("async render, ordered render: awaited in place; slot content still resumable", async () => {
  const html = (await resumableToString(() => mod.Awaited!(), { manifest })) as string;
  assert.match(html, /<main><rivet-island data-ri="i\d+" style="display:contents"><p>late<\/p><rivet-slot style="display:contents"><button data-r="(\d+)">/);
  assert.equal(Object.keys(stateOf(html)!.e).length, 1);
});

test("async render inside a streaming Suspense: fallback first, the island in a segment whose patch holds its effect", async () => {
  const chunks: string[] = [];
  await renderResumable(() => mod.Streamed!(), { write: (chunk) => void chunks.push(chunk) }, { manifest, stream: {} });
  const html = chunks.join("");
  assert.match(html, /<i>wait<\/i>/);
  const shell = stateOf(html)!;
  assert.equal(shell.fx.length, 0, "the island's effect is not in the shell state");
  const template = /<template data-a="(\d+)">(.*?)<\/template>/s.exec(html)!;
  assert.match(template[2]!, /^<rivet-island data-ri="i\d+" style="display:contents" data-r="\d+"><p>streamed<\/p><\/rivet-island>$/);
  const patch = new RegExp('<script type="rivet/state" data-patch="' + template[1] + '">(.*?)</script>', "s").exec(html)!;
  const state = JSON.parse(patch[1]!) as { fx?: [unknown, unknown, string][]; p?: unknown };
  assert.equal(state.fx?.length, 1);
  assert.equal(state.fx![0]![2], "visible");
  // The segment is swapped in by the stream runtime ($rA), after its template + patch.
  assert.ok(html.lastIndexOf("$rA(") > template.index);
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
