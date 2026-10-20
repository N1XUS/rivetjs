// DOM-DATA T3 (spec docs/design/specs/2026-10-20-dom-backed-loader-data-design.md §3.2): in a `resume.domData` build,
// compact list rows whose items are no table array list their item refs as strided runs (`CompactRows.rs`, server
// `server-dom-data.ts` `domStrided`), shipped with the `EXPAND_DOM` add-on (`resume-expand.ts` `strided`), which turns
// them back into `r` before the runtime reads them. The server's build switch is on for this whole file (the compiler
// plugin serves `DOM_DATA = true` to such SSR builds); `resume-dom-data-browser.test.ts` keeps the default server.
import { test, vi } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { CompactRows, ResumeState } from "@rivetjs/runtime/resume-format";
import { withIdScope } from "@rivetjs/runtime/id";
import { EXPAND_DOM } from "../resume-loader.min.ts";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { DOM_DATA_BUILD, withPage, rewrite } from "./resume/harness.ts";
import { domServer } from "../dom-data-server.ts";
import { _domRegistry } from "../server-dom-data.ts";
import type { Served } from "./resume/harness.ts";

vi.mock("../dom-data.ts", () => ({ DOM_DATA: true }));

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Row = { id: number; name: string; mail: string };
// The For iterates a filtered copy of the loader array: no table array holds exactly its items, so the rows list refs.
const source = `import { For } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";
export function Page(p) {
  const sel = signal(-1);
  return <ul><For each={() => p.rows.filter((row) => row.id !== 10)} by={(row) => row.id}>{(row) =>
    <li data-id={row().id} class={sel() === row().id ? "on" : "off"}>
      <b>{row().name}</b>
      <span>{row().mail}</span>
      <button onClick={() => (sel.set(row().id), (globalThis.__row = row()))}>pick</button>
    </li>}</For></ul>;
}`;
const dom = compileResume(source, "dom", "src/strided.tsx");
const mod = await importServer<{ Page(p: { rows: Row[] }): ServerValue }>(compileResume(source, "server", "src/strided.tsx").code);
const symbols = Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"]));
const rows: Row[] = Array.from({ length: 16 }, (_, k) => ({ id: 10 + k, name: "Customer " + k + " Holdings", mail: "customer." + k + "@example.com" }));
domServer.create = _domRegistry;

test("domData build: compact rows' item refs travel strided (`rs`) with `EXPAND_DOM`; clicks decode their row", async () => {
  const html = (await resumableToString(() => withIdScope("rv", () => mod.Page({ rows })), {
    manifest: { runtime: "/rt.js", symbols, domData: true },
  })) as string;
  const state = JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)![1]!) as ResumeState;
  const compact = state.b.map((entry) => entry[8]).filter((spec): spec is CompactRows => spec !== null && typeof spec === "object" && "rs" in spec);
  assert.equal(compact.length, 1);
  assert.equal(compact[0]!.r, undefined);
  assert.ok(html.includes(EXPAND_DOM), "the domData expand add-on ships with the rows");
  const files: Record<string, Served> = {
    "/fixture.mjs": rewrite(dom.code),
    ...DOM_DATA_BUILD,
    "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
    "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
  };
  const byComponent: Record<string, ResumeSymbol[]> = {};
  for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
  for (const [path, list] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(list, "/fixture.mjs"));
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    for (const k of [1, 15, 7]) {
      await page.click(`li:nth-of-type(${k}) button`);
      await page.waitForFunction((n) => document.querySelector(`li:nth-of-type(${n})`)?.className === "on", k);
      assert.deepEqual(await page.evaluate(() => (globalThis as unknown as { __row: unknown }).__row), rows[k]);
    }
    assert.deepEqual(errors, []);
  });
});
