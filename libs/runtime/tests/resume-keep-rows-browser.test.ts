// RESUME-KEEP-ROWS (2026-10-12): adopted rows of a resumed keyed For whose own render read signals (no site inside the
// row binds them: a row body deciding its content from a signal, cdk TabPanels / masonry items) survive the
// first items change while those signals still hold their server values — the region entry lists them at [13]
// (`RowReads`). Once one changes, the For re-creates exactly those rows; a change of one before the first items change
// re-creates them right away, as before.
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
export function Page() {
  const sel = signal(1);
  const rows = signal<Row[]>([{ id: 1 }, { id: 2 }, { id: 3 }]);
  return <main>
    <button id="add" onClick={() => rows.set([...rows(), { id: rows().length + 1 }])}>add</button>
    <button id="drop" onClick={() => rows.set(rows().slice(1))}>drop</button>
    <button id="pick" onClick={() => sel.set(2)}>pick</button>
    <ul id="list"><For each={rows()} by={(r) => r.id}>{(r) => {
      const on = sel() === r().id;
      return <li class={(on ? "on" : "off") + " p" + r().id}>{on ? "on" : "off"} {r().id}</li>;
    }}</For></ul>
  </main>;
}
`;
interface Page {
  files: Record<string, Served>;
  html: string;
}
async function build(source: string, file: string): Promise<Page> {
  const dom = compileResume(source, "dom", file);
  const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", file).code);
  const byComponent: Record<string, ResumeSymbol[]> = {};
  for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
  const manifest: ResumeManifest = {
    hash: "keep",
    runtime: "/rt.js",
    symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
  };
  const files: Record<string, Served> = {
    "/fixture.mjs": rewrite(dom.code),
    "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  };
  for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
  const html = "<!doctype html><html><head></head><body>" + (await resumableToString(() => server.Page(), { manifest })) + "</body></html>";
  return { files, html };
}
const keep = await build(source, "src/keep.tsx");
const html = keep.html;

interface Step {
  /** Server rows (marked before the first click) still in the list, by class. */
  kept: string[];
  text: string;
}
async function run(buttons: string[], page: Page = keep): Promise<{ steps: Step[]; errors: string[] }> {
  return withPage({ ...page.files, "/": page.html }, async (p) => {
    const errors: string[] = [];
    p.on("pageerror", (error) => errors.push(error.message));
    await p.goto("http://rivet.test/");
    await p.evaluate(() => document.querySelectorAll("#list li").forEach((li) => ((li as unknown as { __kept: boolean }).__kept = true)));
    const steps: Step[] = [];
    for (const button of buttons) {
      const before = await p.evaluate(() => document.querySelector("#list")!.innerHTML);
      await p.click(button);
      // First mouse click flushes one task later: wait for the list to change, then a frame.
      await p.waitForFunction((b) => document.querySelector("#list")!.innerHTML !== b, before, { timeout: 2000 }).catch(() => {});
      await p.waitForTimeout(50);
      steps.push(
        await p.evaluate(() => {
          const lis = [...document.querySelectorAll("#list li")];
          return {
            kept: lis.filter((li) => (li as unknown as { __kept?: boolean }).__kept).map((li) => li.className),
            text: lis.map((li) => li.textContent).join("|"),
          };
        }),
      );
    }
    return { steps, errors };
  });
}

test("the server state lists the rows' own reads at [13]", () => {
  const state = JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)![1]!) as { b: unknown[][] };
  const region = state.b.find((entry) => entry[1] === "#" && entry.length > 13);
  assert.ok(region, "a region entry with row reads");
  assert.equal((region![13] as number[]).length, 1, "one signal: sel");
});

test("first items change keeps every server row (node identity); a later change of the read signal re-creates them", async () => {
  const { steps, errors } = await run(["#add", "#pick"]);
  assert.deepEqual(steps[0], { kept: ["on p1", "off p2", "off p3"], text: "on 1|off 2|off 3|off 4" });
  assert.deepEqual(steps[1], { kept: [], text: "off 1|on 2|off 3|off 4" });
  assert.deepEqual(errors, []);
});

test("a removal keeps the other server rows", async () => {
  const { steps, errors } = await run(["#drop"]);
  assert.deepEqual(steps[0], { kept: ["off p2", "off p3"], text: "off 2|off 3" });
  assert.deepEqual(errors, []);
});

test("the read signal changing first re-creates the rows with their region", async () => {
  const { steps, errors } = await run(["#pick", "#add"]);
  assert.deepEqual(steps[0], { kept: [], text: "off 1|on 2|off 3" });
  assert.deepEqual(steps[1], { kept: [], text: "off 1|on 2|off 3|off 4" });
  assert.deepEqual(errors, []);
});

// Review MED: the rows read a signal the enclosing region created for itself (`_regionState`, a component among a
// a conditional child = its own region site). The keep check must resolve the same instance the page's
// handlers and the region's adopted state use (`get(ref)`): kept while unchanged, re-created once it changes.
const local = await build(
  `
import { signal, _regionState } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
type Row = { id: number };
function Tabs(props: { rows: () => Row[] }) {
  const sel = _regionState(() => signal(1));
  return <div>
    <button id="pick" onClick={() => sel.set(2)}>pick</button>
    <ul id="list"><For each={props.rows()} by={(r) => r.id}>{(r) => {
      const on = sel() === r().id;
      return <li class={(on ? "on" : "off") + " p" + r().id}>{on ? "on" : "off"} {r().id}</li>;
    }}</For></ul>
  </div>;
}
export function Page() {
  const rows = signal<Row[]>([{ id: 1 }, { id: 2 }, { id: 3 }]);
  const shown = signal(true);
  return <main>
    <button id="add" onClick={() => rows.set([...rows(), { id: rows().length + 1 }])}>add</button>
    <section>{shown() ? <Tabs rows={rows} /> : null}</section>
  </main>;
}
`,
  "src/keep-local.tsx",
);

test("region-local signal: the state lists it at [13] next to the region's `_regionState` locals", () => {
  const state = JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(local.html)![1]!) as { b: unknown[][] };
  const region = state.b.find((entry) => entry[1] === "#" && entry.length > 13);
  assert.ok(region, "a region entry with row reads");
  assert.equal((region![13] as number[]).length, 1, "one signal: the region-local sel");
  const site = state.b.find((entry) => entry !== region && (entry[11] as { l?: number[] } | undefined)?.l);
  assert.ok(site, "the enclosing region records its `_regionState` local");
  assert.deepEqual((site![11] as { l: number[] }).l, region![13], "rows read the region's own signal");
});

test("region-local signal: rows kept on the first items change, re-created when it changes", async () => {
  const { steps, errors } = await run(["#add", "#pick"], local);
  assert.deepEqual(steps[0], { kept: ["on p1", "off p2", "off p3"], text: "on 1|off 2|off 3|off 4" });
  assert.deepEqual(steps[1], { kept: [], text: "off 1|on 2|off 3|off 4" });
  assert.deepEqual(errors, []);
});

test("region-local signal changing first re-creates the rows", async () => {
  const { steps, errors } = await run(["#pick", "#add"], local);
  assert.deepEqual(steps[0], { kept: [], text: "off 1|on 2|off 3" });
  assert.deepEqual(steps[1], { kept: [], text: "off 1|on 2|off 3|off 4" });
  assert.deepEqual(errors, []);
});
