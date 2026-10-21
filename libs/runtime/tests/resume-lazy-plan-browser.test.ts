// LAZY-COST-2: lazy rows written by the fast server paths, loaded cold in Chromium — row-plan rows from one list tape
// (`lazyPlanRows`, LAZY-COST) and settled component rows rendered by one renderer per For (`writable`, LAZY-COST-2). Each page
// is rendered twice, fast paths on and `_setLazyPlans(false)` (every row through its own `renderToString`, the pre-LAZY-COST
// path), and both pages are driven alike: the first click in a row materialises it (its handler runs), a keyed update
// reorders / renames the rows (the For re-created by its read keys the server rows), and the two pages end with the same
// DOM and the same handler results. DOM-DATA (`resume.domData`): tape rows register their values at their row regions
// (`DomRegistry.lazyTape`), the state carries `D` entries instead of the strings, and a handler reads the row's item back
// from the DOM. The server's `DOM_DATA` build switch is on for this whole file (the compiler plugin serves it to domData
// builds); pages without the manifest flag record no DOM data.
import { afterEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import { _setLazyPlans, resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { ResumeState } from "@rivetjs/runtime/resume-format";
import { withIdScope } from "@rivetjs/runtime/id";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { DOM_DATA_BUILD, LAZY_ROWS_BUILD, withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";
import { domServer } from "../dom-data-server.ts";
import { _domRegistry } from "../server-dom-data.ts";

vi.mock("../dom-data.ts", () => ({ DOM_DATA: true }));
domServer.create = _domRegistry;

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Row = { id: number; name: string; mail: string };
const source = `import { For } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";
import { createId } from "@rivetjs/runtime/id";
// Row-plan rows: a reactive attribute, a handler, sole-child texts (DOM-DATA cells).
export function Plan(p) {
  const sel = signal(-1);
  const list = signal(p.rows);
  return <main>
    <p id="sel">{sel()}</p>
    <button id="update" onClick={() => list.set([...list()].reverse().map((r) => r.id === 2 ? { ...r, name: "Renamed customer two" } : r))}>update</button>
    <table><tbody><For each={list} by={(r) => r.id}>{(row) =>
      <tr data-id={row().id} class={sel() === row().id ? "on" : "off"}>
        <td>{row().name}</td>
        <td>{row().mail}</td>
        <td><button onClick={() => (sel.set(row().id), (globalThis.__row = row()))}>pick</button></td>
      </tr>}</For></tbody></table>
  </main>;
}
// Component rows (the cdk collections' shape): an id from the row seed, a spread, a handler in the component.
function Item(props) {
  const id = createId();
  return <li id={id} {...props.attrs} class={props.sel() === props.row.id ? "on" : "off"} onClick={() => (props.sel.set(props.row.id), (globalThis.__row = props.row))}>{props.row.name}</li>;
}
export function Comp(p) {
  const sel = signal(-1);
  const list = signal(p.rows);
  return <main>
    <p id="sel">{sel()}</p>
    <button id="update" onClick={() => list.set([...list()].reverse().map((r) => r.id === 2 ? { ...r, name: "Renamed customer two" } : r))}>update</button>
    <ul><For each={list} by={(r) => r.id}>{(row) => <Item row={row()} sel={sel} attrs={{ "data-id": row().id, title: row().mail }} />}</For></ul>
  </main>;
}`;
const dom = compileResume(source, "dom", "src/lazy-plan.tsx");
const server = compileResume(source, "server", "src/lazy-plan.tsx");
assert.match(server.code.slice(server.code.indexOf("function Plan(")), /"\$rows"[\s\S]*"\$lazy"/, "Plan: row plan + lazy verdict");
const mod = await importServer<Record<string, (p: { rows: Row[] }) => ServerValue>>(server.code);
const manifest: ResumeManifest = { hash: "lazy-plan", runtime: "/rt.js", symbols: symbolUrls(dom.symbols), lazyRows: "/dom-resume-lazy.ts" };
const byComponent = symbolChunks(dom.symbols);
const rows: Row[] = Array.from({ length: 12 }, (_, k) => ({
  id: k + 1,
  name: "Customer " + (k + 1) + " Holdings & Co",
  mail: "customer." + (k + 1) + "@example.com",
}));

afterEach(() => {
  delete process.env.RIVET_LAZY_ROWS;
  _setLazyPlans(true);
});
const stateOf = (html: string): ResumeState => JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)![1]!) as ResumeState;
async function render(name: string, fast: boolean, domData: boolean): Promise<string> {
  process.env.RIVET_LAZY_ROWS = "on";
  _setLazyPlans(fast);
  try {
    return (await resumableToString(() => withIdScope("rv", () => mod[name]!({ rows })), {
      manifest: { ...manifest, ...(domData ? { domData: true } : {}) },
    })) as string;
  } finally {
    _setLazyPlans(true);
    delete process.env.RIVET_LAZY_ROWS;
  }
}
const files = (html: string, domData: boolean): Record<string, Served> => ({
  "/fixture.mjs": rewrite(dom.code),
  ...LAZY_ROWS_BUILD,
  ...(domData ? DOM_DATA_BUILD : {}),
  "/rt.js":
    'import { createResume } from "/dom-resume.ts"; import { _lazyReady } from "/lazy-rows-resume.ts"; export default createResume({}); await _lazyReady?.();',
  "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
  ...symbolModules(byComponent),
});
// Drives one page: cold clicks in rows 3 and 9 (materialised: handlers run), a keyed update, a click in a moved row. Returns
// the handler results and the final DOM (comments left out: the fast paths leave chained row marker ids out).
async function drive(html: string, domData: boolean): Promise<{ picked: unknown[]; body: string }> {
  let out!: { picked: unknown[]; body: string };
  await withPage(files(html, domData), async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    const row = (k: number) => `[data-id="${k}"]`;
    const press = (k: number) => page.click(`${row(k)} button, li${row(k)}`);
    const picked: unknown[] = [];
    for (const k of [3, 9]) {
      await press(k);
      await page.waitForFunction(
        ([s, v]) => document.querySelector(s!)?.className === "on" && document.querySelector("#sel")?.textContent === v,
        [row(k), String(k)],
        {
          timeout: 5000,
        },
      );
      picked.push(await page.evaluate(() => (globalThis as unknown as { __row: unknown }).__row));
    }
    await page.click("#update");
    await page.waitForFunction(() => document.querySelector('[data-id="2"]')?.textContent?.includes("Renamed customer two"), undefined, { timeout: 5000 });
    await press(12);
    await page.waitForFunction(() => document.querySelector("#sel")?.textContent === "12", undefined, { timeout: 5000 });
    picked.push(await page.evaluate(() => (globalThis as unknown as { __row: unknown }).__row));
    const body = await page.evaluate(() => {
      const main = document.querySelector("main")!.cloneNode(true) as Element;
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_COMMENT);
      const comments: Node[] = [];
      while (walker.nextNode()) comments.push(walker.currentNode);
      for (const c of comments) c.parentNode!.removeChild(c);
      return main.outerHTML;
    });
    assert.deepEqual(errors, []);
    out = { picked, body };
  });
  return out;
}

for (const name of ["Plan", "Comp"])
  test(`${name}: fast-path lazy rows boot cold, materialise on the first click, follow a keyed update — same as the row-by-row path`, async () => {
    const fast = await render(name, true, false),
      slow = await render(name, false, false);
    assert.equal(stateOf(fast).L?.length, 1, "one lazy For");
    assert.equal(JSON.stringify(stateOf(fast)), JSON.stringify(stateOf(slow)), "same state");
    assert.ok(fast.length < slow.length, "chained row marker ids left out");
    assert.match(fast, /<!--r\[-->/);
    const [a, b] = [await drive(fast, false), await drive(slow, false)];
    assert.deepEqual(a.picked, [rows[2], rows[8], rows[11]]);
    assert.deepEqual(a, b);
  });

test("DOM-DATA + row-plan lazy rows: tape rows register their cells (D entries, no strings in the state); handlers read the rows back from the DOM", async () => {
  const fast = await render("Plan", true, true),
    slow = await render("Plan", false, true);
  const state = stateOf(fast);
  assert.equal(state.D, 1);
  assert.equal(JSON.stringify(state), JSON.stringify(stateOf(slow)), "same state as rows registered one by one");
  for (const r of rows) assert.ok(!JSON.stringify(state).includes(r.name.slice(0, 12)), "names come from the DOM");
  // The tape wrote the rows (chained marker ids left out): before LAZY-COST-2 a domData render took the row-by-row path.
  assert.ok(fast.length < slow.length, "tape rows");
  const [a, b] = [await drive(fast, true), await drive(slow, true)];
  assert.deepEqual(a.picked, [rows[2], rows[8], rows[11]]);
  assert.deepEqual(a, b);
});

test("DOM-DATA + component lazy rows (one renderer per For): registered as rows rendered one by one", async () => {
  const fast = await render("Comp", true, true),
    slow = await render("Comp", false, true);
  assert.equal(JSON.stringify(stateOf(fast)), JSON.stringify(stateOf(slow)));
  assert.equal(stateOf(fast).D, 1);
  assert.ok(fast.length < slow.length, "rows rendered by one renderer (chained marker ids)");
  const [a, b] = [await drive(fast, true), await drive(slow, true)];
  assert.deepEqual(a.picked, [rows[2], rows[8], rows[11]]);
  assert.deepEqual(a, b);
});
