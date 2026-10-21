// VIRT-LEAK (2026-10-21): server memory per render. A keyed selector read during a resumable render schedules the
// selector's index fold in a timer (reactivity `later`); a Node timer keeps the async context it was created in, so the
// fold used to keep the render's resume recorder — and every record, region and row of the render — alive until the
// timer phase. An in-process loop that never reaches it (benchmarks; a poll phase serving many requests) retained every
// render (cdk `/virtualized-collections`: ~12 MB / render). server-resume now creates the fold timers outside the
// request's context (`_scheduleFolds`). The loop below renders without yielding to timers and checks the heap stays flat.
import { test } from "vitest";
import assert from "node:assert/strict";
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { withIdScope } from "@rivetjs/runtime/id";
import { compileResume, importServer } from "./resume/compile.ts";

setFlagsFromString("--expose-gc");
const gc = runInNewContext("gc") as () => void;

const source = `import { For } from "@rivetjs/runtime/dom";
import { computed, signal, selector } from "@rivetjs/reactivity";
export const picked = signal(-1);
export function List(p) {
  // A keyed selector of this render (cdk: one per collection state) read inside a computed (cdk collection item state:
  // \`selectionOf\`, \`isFocusedKey\`): the read subscribes a key source and schedules the selector's fold.
  const isOn = computed(() => selector(picked));
  return <ul><For each={() => p.rows} by={(r) => r.id}>{(row) => {
    const on = computed(() => isOn()(row().id));
    return <li class={on() ? "on" : "off"} title={row().label} onClick={() => picked.set(row().id)}>{row().label}</li>;
  }}</For></ul>;
}
`;
const server = compileResume(source, "server", "src/memory.tsx");
type Row = { id: number; label: string };
const mod = await importServer<{ List: (p: { rows: Row[] }) => unknown }>(server.code);
const dom = compileResume(source, "dom", "src/memory.tsx");
const manifest = { hash: "mem", runtime: "/rt.js", symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])) };
// Fresh rows per render (a request's data).
const render = () => {
  const rows = Array.from({ length: 2000 }, (_, i) => ({ id: i, label: `row ${i} ` + "·".repeat(240) }));
  return resumableToString(() => withIdScope("m", () => mod.List({ rows }) as never), { manifest }) as Promise<string>;
};
const heap = (): number => {
  gc();
  gc();
  return process.memoryUsage().heapUsed;
};

test("a render with keyed selector reads is released before the timer phase (bounded heap over 20 renders)", async () => {
  const html = await render();
  assert.match(html, /class="off"/);
  for (let i = 0; i < 3; i++) await render();
  // No timer task runs between these renders or before the measurement (renders settle in microtasks).
  const before = heap();
  const n = 20;
  for (let i = 0; i < n; i++) await render();
  const perRender = (heap() - before) / n;
  // Retained before the fix: ~1.5 MB / render (the rows, their records and the recorder). Loose bound after warm-up.
  console.log(`server-memory: ${(perRender / 1e6).toFixed(3)} MB / render`);
  assert.ok(perRender < 256 * 1024, `heap grew ${(perRender / 1e6).toFixed(2)} MB / render`);
});
