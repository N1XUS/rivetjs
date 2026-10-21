// LAZY-FLIP 2026-10-21: a lazy For writes no row handler records, so the preload planner had nothing to plan its rows'
// chunks from — a lazy page fetched its row function's chunk (and its static closure: the route's resume chunk, cdk DOM
// code) at the first click (story harness, Slow 4G + 4× CPU: first row click 28 → 467 ms on `/grid-list`). The planner
// now plans a lazy entry's chunks (`L` [6]) as its rows' handlers would: visible, fetched at idle by the background budget.
// `LAZY_ROWS` is the server switch of `resume.lazyRows` builds (mocked on here, as the plugin serves it).
import { afterEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { ResumeState } from "@rivetjs/runtime/resume-format";
import { withIdScope } from "@rivetjs/runtime/id";
import { compileResume, importServer } from "./resume/compile.ts";
import { readable } from "./resume/wire.ts";

vi.mock("../lazy-rows.ts", () => ({ LAZY_ROWS: true }));

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Row = { id: number; label: string };
const source = `import { For } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";
export const sel = signal(0);
export function Row(p) {
  return <li class={sel() === p.row().id ? "on" : "off"}><button onClick={() => sel.set(p.row().id)}>{p.row().label}</button></li>;
}
export function List(p) {
  return <ul><For each={() => p.rows} by={(r) => r.id}>{(row) => <Row row={row} />}</For></ul>;
}
`;
const dom = compileResume(source, "dom", "src/rows.tsx");
const mod = await importServer<{ List(p: { rows: Row[] }): ServerValue }>(compileResume(source, "server", "src/rows.tsx").code);
const chunkOf = (component: string) => "/c/" + component + ".js";
// Build manifest fields (`sizes`) beyond the public contract, as in resume-preload-hook.test.ts.
const manifest = {
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, chunkOf(s.component)])),
  sizes: { "/rt.js": 1000, [chunkOf("Row")]: 200, [chunkOf("List")]: 200 },
  lazyRows: true,
} as ResumeManifest;
const rows: Row[] = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, label: "row " + (i + 1) }));
const render = async (mode: "on" | "off", list: Row[] = rows) => {
  process.env.RIVET_LAZY_ROWS = mode;
  const html = (await resumableToString(() => withIdScope("rv", () => mod.List({ rows: list })), { manifest })) as string;
  const state = readable(JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)![1]!)) as ResumeState;
  const attr = /data-preload="([^"]*)"/.exec(html)?.[1];
  const schedule = attr ? (JSON.parse(attr.replace(/&quot;/g, '"').replace(/&amp;/g, "&")) as [string, string, number[]?][]).slice(1) : [];
  return { state, schedule };
};
afterEach(() => void delete process.env.RIVET_LAZY_ROWS);

test("lazy rows: the row function's chunks are in the preload plan (visible, background-fetched at idle), like recorded rows' handlers", async () => {
  const recorded = await render("off");
  assert.equal(recorded.state.L, undefined);
  const lazy = await render("on");
  assert.equal(lazy.state.L?.length, 1);
  const needed = lazy.state.L![0]![6].map((i) => lazy.state.c[i]!);
  assert.ok(needed.length > 0, "the lazy entry names its row chunks");
  for (const url of needed) {
    const entry = lazy.schedule.find(([u]) => u === url);
    assert.ok(entry, `${url} planned (schedule ${JSON.stringify(lazy.schedule)})`);
    // In the background budget: fetched at idle, no viewport observation (lazy rows carry no element ids).
    assert.equal(entry![1], "P");
  }
  // Every chunk the recorded page plans for its rows is planned on the lazy page too.
  for (const [url] of recorded.schedule)
    assert.ok(
      lazy.schedule.some(([u]) => u === url),
      `${url} also planned with lazy rows`,
    );
});

test("lazy rows: a short list of click rows (under 3 rows) plans nothing before input, as its recorded rows' click handlers (intent)", async () => {
  const short = rows.slice(0, 2);
  const recorded = await render("off", short);
  assert.deepEqual(recorded.schedule, []);
  const lazy = await render("on", short);
  assert.equal(lazy.state.L?.length, 1);
  assert.deepEqual(lazy.schedule, []);
});
