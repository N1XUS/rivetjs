// Suspense in streaming resumable renders: Asyncs below never stream on their own; a pending Suspense
// writes its fallback and streams all of its content as one segment (with its handlers in the patch).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderResumable, resumableToString } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer } from "./resume/compile.ts";

type ServerValue = ReturnType<Parameters<typeof renderResumable>[0]>;
type Boundary = [number, unknown, number, number];
interface Props {
  a: number;
  b: number;
  fail?: boolean;
  sync?: boolean;
}
const source = `
import { signal } from "@rivetjs/reactivity";
import { Async, Suspense } from "@rivetjs/runtime/server";
const later = (ms, value, fail) => new Promise((resolve, reject) => setTimeout(() => (fail ? reject(new Error(value)) : resolve(value)), ms));
export function Page({ a, b, fail, sync }) {
  const n = signal(0);
  return <main>
    <h1 onClick={() => n.set(n() + 1)}>{n()}</h1>
    <section><Suspense fallback={() => <i>wait all</i>}>{() => <>
      <Async load={() => (sync ? "now" : later(a, "slow"))} fallback={() => <i>wait a</i>}>{(v) => <button onClick={() => n.set(5)}>{v}</button>}</Async>
      <Async load={() => (sync ? "now" : later(b, "fast", fail))} fallback={() => <i>wait b</i>}>{(v) =>
        <p>{v}<Async load={() => later(1, "inner")} fallback={() => <i>wait inner</i>}>{(w) => <b>{w}</b>}</Async></p>}</Async>
    </>}</Suspense></section>
    <aside><Async load={() => later(1, "solo")} fallback={() => <i>wait solo</i>}>{(v) => <em>{v}</em>}</Async></aside>
  </main>;
}
`;
const symbols = compileResume(source, "dom").symbols;
const manifest = { hash: "h", runtime: "/rt.js", symbols: Object.fromEntries(symbols.map((s) => [s.id, "/c/" + s.component + ".js"])) };
const mod = await importServer<{ Page(props: Props): ServerValue }>(compileResume(source, "server").code);
const render = async (props: Props): Promise<string> => {
  const chunks: string[] = [];
  await renderResumable(() => mod.Page(props), { write: (chunk) => void chunks.push(chunk) }, { manifest, stream: {} });
  return chunks.join("");
};
const shell = (html: string) => JSON.parse(/<script type="rivet\/state" data-region="0"[^>]*>(.*?)<\/script>/s.exec(html)![1]!) as { t: unknown[]; a?: Boundary[] };
const patches = (html: string) =>
  [...html.matchAll(/<script type="rivet\/state" data-patch="(\d+)">(.*?)<\/script>/gs)].map(([, id, json]) => ({ id: Number(id), ...(JSON.parse(json!) as { a: Boundary[]; e?: Record<string, unknown> }) }));

test("stream: a pending Suspense writes one fallback and streams all of its content as one segment", async () => {
  const html = await render({ a: 20, b: 5 });
  const state = shell(html);
  assert.match(html, /<section><!--r\d+\[--><!--r\d+\[--><i>wait all<\/i><!--\]--><!--\]--><\/section>/);
  // Asyncs below never stream (nor render their fallbacks); the sibling Async outside still does.
  assert.doesNotMatch(html, /<i>wait (a|b|inner)<\/i>/);
  assert.match(html, /wait solo/);
  assert.equal(state.a!.length, 2);
  const list = patches(html);
  assert.equal(list.length, 2);
  const suspense = list.find((patch) => patch.id === state.a![0]![0])!;
  assert.deepEqual(suspense.a, [[...state.a![0]!.slice(0, 3), 1]]);
  // Whole content (nested Async included) in one template; the button's handler rides in its patch.
  assert.match(html, new RegExp('<template data-a="' + suspense.id + '"><button data-r="\\d+">slow</button><p>fast<b>inner</b></p></template>'));
  assert.equal(Object.keys(suspense.e ?? {}).length, 1);
});

test("stream: a Suspense whose content is synchronous renders in place (no fallback, no segment)", async () => {
  const html = await render({ a: 0, b: 0, sync: true });
  assert.doesNotMatch(html, /wait all/);
  assert.match(html, /<section><button data-r="\d+">now<\/button><p>now<b>inner<\/b><\/p><\/section>/);
  assert.equal(patches(html).filter((patch) => patch.a?.some(([, , , status]) => status === 1)).length, 1, "only the sibling Async streams");
});

test("stream: a failure inside the Suspense continues it in the browser", async () => {
  const html = await render({ a: 5, b: 1, fail: true });
  const state = shell(html);
  const list = patches(html);
  const suspense = list.find((patch) => patch.id === state.a![0]![0])!;
  assert.deepEqual(suspense.a, [[...state.a![0]!.slice(0, 3), 2]]);
  assert.doesNotMatch(html, /<template data-a="[^"]+"><button/);
});

test("ordered resumable render awaits the Suspense content in place", async () => {
  const html = (await resumableToString(() => mod.Page({ a: 1, b: 1 }), { manifest })) as string;
  assert.match(html, /<section><button data-r="\d+">slow<\/button><p>fast<b>inner<\/b><\/p><\/section>/);
  assert.doesNotMatch(html, /wait/);
});
