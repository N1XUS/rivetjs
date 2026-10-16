// Chunks a handler needs (`e` entry [2]) through its captures: walks memoised per table entry (shared contexts / props
// objects are walked once per encode), and captured cyclic plain data falls back to the one-stack walk (same chunks).
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer } from "./resume/compile.ts";
import { readable } from "./resume/wire.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = `
import { signal } from "@rivetjs/reactivity";
type Bag = { run: () => void; count: () => number; self?: Bag; peer?: Bag };
export function Act(props: { bag: Bag; id: string }) {
  return <button id={props.id} onClick={() => props.bag.run()}>act</button>;
}
export function Plain() {
  const count = signal(0);
  const bag: Bag = { run: () => count(count() + 1), count };
  return <section><p>{count()}</p><Act bag={bag} id="plain" /><Act bag={bag} id="again" /></section>;
}
export function Cyclic() {
  const count = signal(0);
  const bag: Bag = { run: () => count(count() + 1), count };
  const peer: Bag = { run: () => {}, count, peer: bag };
  bag.self = bag;
  bag.peer = peer;
  return <section><p>{count()}</p><Act bag={bag} id="cyclic" /><Act bag={peer} id="peer" /></section>;
}
export function Page() {
  return <main><Plain /><Cyclic /></main>;
}
`;
const dom = compileResume(source, "dom", "src/reach.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/reach.tsx").code);
const manifest: ResumeManifest = {
  hash: "reach",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const html = await resumableToString(() => server.Page(), { manifest });
const state = readable(JSON.parse(html.match(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/)![1]!));

const idOf = (selector: string): string => html.match(new RegExp(`<button id="${selector}" data-r="(\\d+)"`))![1]!;
const chunksOf = (selector: string): string[] => {
  const entry = state.e[idOf(selector)].click as [unknown, number[], number[], number[]?];
  return [...entry[2], ...(entry[3] ?? [])].map((i) => state.c[i] as string).sort();
};

test("a handler needs its own chunk plus the chunks of functions its captures reach", () => {
  // `props.bag.run` lives in Plain's chunk; the binding reading `count` too.
  assert.deepEqual(chunksOf("plain"), ["/c/Act.js", "/c/Plain.js"]);
  // Two captures of one props object: the memoised walk gives the same chunks.
  assert.deepEqual(chunksOf("again"), chunksOf("plain"));
});

test("captured cyclic plain data: the walk terminates and finds the same chunks", () => {
  assert.deepEqual(chunksOf("cyclic"), ["/c/Act.js", "/c/Cyclic.js"]);
  // Reached through the cycle from the other side (peer → bag → self …).
  assert.deepEqual(chunksOf("peer"), ["/c/Act.js", "/c/Cyclic.js"]);
});
