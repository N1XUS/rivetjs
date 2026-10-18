// RESUME-DROP-MARKERS (2026-10-18): adopted rows a resumed keyed For drops on its region's first run leave their two
// server marker comments in place (`dom-adopt.ts` `left`): the first reconcile removes one node per dropped `<li>`,
// not three (resume-bench `filter`: 1,000 → 100 rows, the 1,800 comment removals were ~1/3 of the input task at 4× CPU).
// Kept rows keep their markers as anchors (they move with the row); rows dropped by a later change remove their
// markers with their nodes, as before; the orphan comments are inert for later inserts, reorders and clears.
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
type Row = { id: number };
const all = (): Row[] => [1, 2, 3, 4, 5, 6].map((id) => ({ id }));
export function Page() {
  const rows = signal(all());
  const sel = signal(0);
  return <main>
    <button id="odd" onClick={() => rows.set(all().filter((r) => r.id % 2))}>odd</button>
    <button id="first" onClick={() => rows.set(rows().slice(0, 1))}>first</button>
    <button id="all" onClick={() => rows.set(all())}>all</button>
    <button id="rev" onClick={() => rows.set(rows().slice().reverse())}>rev</button>
    <button id="none" onClick={() => rows.set([])}>none</button>
    <button id="pick" onClick={() => sel.set(5)}>pick</button>
    <ul id="list"><For each={rows()} by={(r) => r.id}>{(r) => <li class={sel() === r().id ? "r" + r().id + " sel" : "r" + r().id}>{r().id}</li>}</For></ul>
  </main>;
}
`;
const dom = compileResume(source, "dom", "src/drop.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/drop.tsx").code);
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const manifest: ResumeManifest = { hash: "drop", runtime: "/rt.js", symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])) };
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
const html = "<!doctype html><html><head></head><body>" + (await resumableToString(() => server.Page(), { manifest })) + "</body></html>";

interface Step {
  /** Server `<li>` nodes still in the list (marked before the first click), by class. */
  kept: string[];
  text: string;
  /** Nodes removed from the list by this step, by type: `li` / `#comment`. */
  removed: string[];
  /** Direct child comments of the list (region markers, row markers, orphans). */
  comments: number;
}
async function run(buttons: string[]): Promise<{ steps: Step[]; errors: string[] }> {
  return withPage({ ...files, "/": html }, async (p) => {
    const errors: string[] = [];
    p.on("pageerror", (error) => errors.push(error.message));
    await p.goto("http://rivet.test/");
    await p.evaluate(() => {
      document.querySelectorAll("#list li").forEach((li) => ((li as unknown as { __kept: boolean }).__kept = true));
      const w = window as unknown as { __removed: string[] };
      w.__removed = [];
      new MutationObserver((records) => {
        for (const r of records) for (const n of r.removedNodes) w.__removed.push(n.nodeName.toLowerCase());
      }).observe(document.getElementById("list")!, { childList: true });
    });
    const steps: Step[] = [];
    for (const button of buttons) {
      const before = await p.evaluate(() => document.querySelector("#list")!.innerHTML);
      await p.click(button);
      // The first mouse click flushes one task later: wait for the list to change, then a frame.
      await p.waitForFunction((b) => document.querySelector("#list")!.innerHTML !== b, before, { timeout: 2000 }).catch(() => {});
      await p.waitForTimeout(50);
      steps.push(
        await p.evaluate(() => {
          const w = window as unknown as { __removed: string[] };
          const list = document.getElementById("list")!,
            lis = [...list.querySelectorAll("li")],
            removed = w.__removed;
          w.__removed = [];
          return {
            kept: lis.filter((li) => (li as unknown as { __kept?: boolean }).__kept).map((li) => li.className),
            text: lis.map((li) => li.textContent).join("|"),
            removed: removed.sort(),
            comments: [...list.childNodes].filter((n) => n.nodeType === 8).length,
          };
        }),
      );
    }
    return { steps, errors };
  });
}

test("rows dropped on the first run remove their <li> only; kept rows keep their markers; later drops remove markers too", async () => {
  const { steps, errors } = await run(["#odd", "#first", "#none"]);
  // 6 rows → 3: three `<li>` removed, no comment; the list holds 2 region + 3 × 2 kept-row + 3 × 2 orphan markers.
  assert.deepEqual(steps[0], { kept: ["r1", "r3", "r5"], text: "1|3|5", removed: ["li", "li", "li"], comments: 14 });
  // 3 → 1 after the first run: a dropped kept row takes its two markers along (3 nodes per row).
  assert.deepEqual(steps[1], { kept: ["r1"], text: "1", removed: ["#comment", "#comment", "#comment", "#comment", "li", "li"], comments: 10 });
  assert.deepEqual(steps[2], { kept: [], text: "", removed: ["#comment", "#comment", "li"], comments: 8 });
  assert.deepEqual(errors, []);
});

test("orphan markers are inert: inserts, reorders and resumed bindings of kept rows keep working", async () => {
  const { steps, errors } = await run(["#odd", "#all", "#rev", "#pick"]);
  assert.deepEqual(steps[0].text, "1|3|5");
  // Re-adding rows 2, 4, 6 creates them in order next to the kept server rows.
  assert.deepEqual(steps[1], { kept: ["r1", "r3", "r5"], text: "1|2|3|4|5|6", removed: [], comments: 14 });
  // A reorder moves kept rows with their markers (no node removed for good: a move is remove + insert of the same node).
  assert.deepEqual(steps[2].text, "6|5|4|3|2|1");
  assert.deepEqual(steps[2].kept, ["r5", "r3", "r1"]);
  assert.equal(steps[2].comments, 14);
  // The resumed class binding of a kept, moved server row still updates (row-template lookup through its markers).
  assert.deepEqual(steps[3].kept, ["r5 sel", "r3", "r1"]);
  assert.deepEqual(steps[3].text, "6|5|4|3|2|1");
  assert.deepEqual(errors, []);
});
