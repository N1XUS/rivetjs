// DOM-DATA (spec docs/design/specs/2026-10-20-dom-backed-loader-data-design.md): with a `resume.domData` build (manifest
// `domData`), plain JSON loader data whose strings / numbers the page rendered as an element's whole text or a plain
// attribute is written as `D` entries (`resume-format.ts` `DomTree`) and read back from the DOM by the browser runtime
// (`dom-resume-data.ts`): the same values (deep equal, real arrays, identity between the list and its rows), with keyed
// row plans and with lazy rows; snapshot at the first idle (a later DOM change does not reach the data).
import { afterEach, test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { EntryRecord, ResumeState } from "@rivetjs/runtime/resume-format";
import { withIdScope } from "@rivetjs/runtime/id";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { DOM_DATA_BUILD, LAZY_ROWS_BUILD, withPage, rewrite } from "./resume/harness.ts";
import { domServer } from "../dom-data-server.ts";
import { _domRegistry } from "../server-dom-data.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Row = { id: number; name: string; mail: string; note: string; tags: string[] };
const source = `import { For } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";
export function Page(p) {
  const sel = signal(-1);
  return <main>
    <button id="all" onClick={() => (globalThis.__all = p.rows)}>all</button>
    <ul><For each={() => p.rows} by={(row) => row.id}>{(row) =>
      <li data-id={row().id} class={sel() === row().id ? "on" : "off"}>
        <b>{row().name}</b>
        <span>{row().mail}</span>
        <i>Note: {row().note}</i>
        <button onClick={() => (sel.set(row().id), (globalThis.__row = row()))}>pick</button>
      </li>}</For></ul>
  </main>;
}`;
const dom = compileResume(source, "dom", "src/dd.tsx");
const mod = await importServer<{ Page(p: { rows: Row[] }): ServerValue }>(compileResume(source, "server", "src/dd.tsx").code);
const symbols = Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"]));
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
// Entities, a repeated name (rows 1 and 3), a CR (never DOM-backed: the parser normalises it), a long text.
const rows: Row[] = [0, 1, 2, 3, 4, 5].map((k) => ({
  id: 10 + k,
  name: k === 3 ? "Ada Lovelace & Co" : k === 1 ? "Ada Lovelace & Co" : "Customer <" + k + "> Holdings",
  mail: k === 4 ? "line\r\nbreak@example.com" : "customer." + k + "@example.com",
  note: "prefers email " + k,
  tags: ["t" + k],
}));

// The server half of a `resume.domData` build (the compiler plugin serves `dom-data-server.ts` with the registry).
domServer.create = _domRegistry;
afterEach(() => void delete process.env.RIVET_LAZY_ROWS);
const render = async (manifest: ResumeManifest, lazy = false): Promise<string> => {
  if (lazy) process.env.RIVET_LAZY_ROWS = "on";
  try {
    return (await resumableToString(() => withIdScope("rv", () => mod.Page({ rows })), { manifest })) as string;
  } finally {
    delete process.env.RIVET_LAZY_ROWS;
  }
};
const stateOf = (html: string): ResumeState => JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)![1]!) as ResumeState;
const entries = (state: ResumeState): EntryRecord[] =>
  state.t.filter((entry): entry is EntryRecord => entry !== null && typeof entry === "object" && ("D" in entry || "Dr" in entry));
const files = (body: string, lazy: boolean, dd: boolean): Record<string, Served> => {
  const out: Record<string, Served> = {
    "/fixture.mjs": rewrite(dom.code),
    ...(dd ? DOM_DATA_BUILD : {}),
    ...(lazy ? LAZY_ROWS_BUILD : {}),
    "/rt.js":
      'import { createResume } from "/dom-resume.ts"; import { _lazyReady } from "/lazy-rows-resume.ts"; export default createResume({}); await _lazyReady?.();',
    "/": "<!doctype html><html><head></head><body>" + body + "</body></html>",
  };
  for (const [path, list] of Object.entries(byComponent)) out[path] = rewrite(compileSymbolModule(list, "/fixture.mjs"));
  return out;
};

test("default build (no domData): no D entries, the strings stay in the state", async () => {
  const html = await render({ runtime: "/rt.js", symbols });
  const state = stateOf(html);
  assert.equal(state.D, undefined);
  assert.deepEqual(entries(state), []);
  assert.ok(JSON.stringify(state.t).includes("prefers email 2"));
});

for (const [dd, lazy] of [
  [true, false],
  [true, true],
  [false, true],
] as const)
  test(`${dd ? "domData build" : "default build"}${lazy ? " + lazy rows" : ""}: rows decode to the server's data${dd ? "; snapshot at idle" : ""}`, async () => {
    const manifest: ResumeManifest = { runtime: "/rt.js", symbols, ...(dd ? { domData: true } : {}), ...(lazy ? { lazyRows: "/dom-resume-lazy.ts" } : {}) };
    const html = await render(manifest, lazy);
    const state = stateOf(html);
    const wire = JSON.stringify(state.t);
    // Lazy rows over loader data (items = an `i` child of the props tree, or a `D` tree): the L record carries the row
    // count (the lazy add-on's row range; the items entry does not show it).
    if (lazy) (assert.equal(state.L?.length, 1), assert.equal(state.L![0]![13], rows.length));
    if (dd) {
      assert.equal(state.D, 1);
      // DOM-backed: the sole-child texts (<b>, <span>), the `data-id` numbers; not the CR string, not the mixed `<i>` text.
      assert.ok(wire.includes("prefers email 2"), "notes stay literals (their text is not alone in its <i>)");
      assert.ok(!wire.includes("customer.2@example.com"));
      assert.ok(!wire.includes("Customer <2> Holdings"));
      assert.ok(wire.includes("line\\r\\nbreak@example.com"));
      assert.ok(entries(state).length > 0);
    } else assert.ok(wire.includes("customer.2@example.com"));
    await withPage(files(html, lazy, dd), async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => message.type() === "warning" && errors.push(message.text()));
      await page.goto("http://rivet.test/");
      await page.click("li:nth-of-type(3) button");
      await page.waitForFunction(() => document.querySelector("li:nth-of-type(3)")?.className === "on");
      assert.deepEqual(await page.evaluate(() => (globalThis as unknown as { __row: unknown }).__row), rows[2]);
      // After the first idle every tree is a snapshot: DOM edits do not reach the data.
      await page.evaluate(() => new Promise((resolve) => requestIdleCallback(resolve)));
      await page.evaluate(() => {
        for (const b of document.querySelectorAll("li b")) b.textContent = "edited";
        for (const li of document.querySelectorAll("li")) li.setAttribute("data-id", "0");
      });
      await page.click("#all");
      await page.waitForFunction(() => (globalThis as unknown as { __all?: unknown }).__all !== undefined);
      const all = await page.evaluate(() => {
        const g = globalThis as unknown as { __all: unknown[]; __row: unknown };
        // Identity: the list holds the very row object a row's handler captured (when both decoded from one tree).
        return { all: g.__all, array: Array.isArray(g.__all), same: g.__all.includes(g.__row) };
      });
      assert.deepEqual(all.all, rows);
      assert.equal(all.array, true);
      assert.equal(all.same, true);
      await page.click("li:nth-of-type(5) button");
      await page.waitForFunction(() => document.querySelector("li:nth-of-type(5)")?.className === "on");
      assert.deepEqual(await page.evaluate(() => (globalThis as unknown as { __row: unknown }).__row), rows[4]);
      assert.deepEqual(errors, []);
    });
  });
