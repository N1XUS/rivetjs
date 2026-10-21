// LAZY-BLOCKERS item 2: lazy rows reading a signal every row shares (`selected() === row().id`, ssr-bench `/resume`) no
// longer materialise every row on its first change. Detached sample runs of the first and last rows find the hoisted
// `_fx1` bindings reading it; when every capture is one an inert row supplies (its element, item / index getter, a value
// shared by both samples) and nothing else reads it, each change reruns those bindings over the inert rows' server
// elements (row writers). Any other read (a nested insert / Show, the row body) wakes the For as before.
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { LazyRowsEntry, ResumeState } from "@rivetjs/runtime/resume-format";
import { withIdScope } from "@rivetjs/runtime/id";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { LAZY_ROWS_BUILD, withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type R = { id: number; label: string };
const source = `import { For } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";
const log = (globalThis.__log ??= []);
export function Page(p) {
  const selected = signal(-1);
  return <main>
    <ul id="w"><For each={() => p.rows} by={(r) => r.id}>{(row) => {
      log.push("w" + row().id);
      return <li data-state={selected() === row().id ? "selected" : "even"}><button class="pick" onClick={() => selected.set(row().id)}>{row().label}</button></li>;
    }}</For></ul>
    <ul id="s"><For each={() => p.rows} by={(r) => r.id}>{(row) => {
      log.push("s" + row().id);
      return <li>{row().label}{selected() === row().id ? <b>on</b> : null}</li>;
    }}</For></ul>
    <button id="pick3" onClick={() => selected.set(3)}>3</button>
    <button id="pick5" onClick={() => selected.set(5)}>5</button>
  </main>;
}`;
const dom = compileResume(source, "dom", "src/writers.tsx");
const mod = await importServer<{ Page(p: { rows: R[] }): ServerValue }>(compileResume(source, "server", "src/writers.tsx").code);
const manifest: ResumeManifest = {
  hash: "writers",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
  lazyRows: "/dom-resume-lazy.ts",
};
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const rows: R[] = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, label: "row " + (i + 1) }));
process.env.RIVET_LAZY_ROWS = "on";
let body: string;
try {
  body = (await resumableToString(() => withIdScope("rv", () => mod.Page({ rows })), { manifest })) as string;
} finally {
  delete process.env.RIVET_LAZY_ROWS;
}
const state = JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(body)![1]!) as ResumeState;
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  ...LAZY_ROWS_BUILD,
  "/rt.js":
    'import { createResume } from "/dom-resume.ts"; import { _lazyReady } from "/lazy-rows-resume.ts"; export default createResume({}); await _lazyReady?.();',
  "/": "<!doctype html><html><head></head><body>" + body + "</body></html>",
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
type Page = import("playwright").Page;
const states = (page: Page) => page.evaluate(() => [...document.querySelectorAll("#w li")].map((li) => li.getAttribute("data-state")));
const log = (page: Page) => page.evaluate(() => (globalThis as { __log?: string[] }).__log!.splice(0));

test("server: both lists are lazy and read the shared signal (entry [7])", () => {
  const L = state.L as LazyRowsEntry[];
  assert.equal(L.length, 2);
  for (const e of L) assert.ok(Array.isArray(e[7]) && e[7].length, "reads recorded");
});

test("browser: a shared-read change reruns the rows' writers over inert rows (two samples, no materialisation); other reads wake", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    await page.evaluate(() => document.querySelectorAll("#w li").forEach((li, i) => ((li as HTMLElement & { __k?: number }).__k = i)));
    await page.evaluate(() => ((globalThis as { __log?: string[] }).__log ??= []));
    await page.click("#pick3");
    await page.waitForFunction(() => document.querySelector("#w li:nth-of-type(3)")!.getAttribute("data-state") === "selected");
    assert.deepEqual(await states(page), ["even", "even", "selected", "even", "even", "even"]);
    // `#w`: its first and last rows sampled once, nothing materialised; `#s` (a nested insert reads it): woken, every row
    // materialised (probe + adopt runs) — and it shows the change.
    const ran = await log(page);
    assert.deepEqual(ran.filter((r) => r[0] === "w").sort(), ["w1", "w6"]);
    assert.ok(
      ["s1", "s2", "s3", "s4", "s5", "s6"].every((r) => ran.includes(r)),
      ran.join(),
    );
    assert.equal(await page.evaluate(() => document.querySelector("#s li:nth-of-type(3) b")?.textContent), "on");
    await page.click("#pick5");
    await page.waitForFunction(() => document.querySelector("#w li:nth-of-type(5)")!.getAttribute("data-state") === "selected");
    assert.deepEqual(await states(page), ["even", "even", "even", "even", "selected", "even"]);
    assert.deepEqual(
      (await log(page)).filter((r) => r[0] === "w"),
      [],
      "writers again, no row run",
    );
    // A click inside an inert row materialises it in place; its own binding follows later changes.
    await page.click("#w li:nth-of-type(2) button");
    await page.waitForFunction(() => document.querySelector("#w li:nth-of-type(2)")!.getAttribute("data-state") === "selected");
    assert.deepEqual(await states(page), ["even", "selected", "even", "even", "even", "even"]);
    await page.click("#pick3");
    await page.waitForFunction(() => document.querySelector("#w li:nth-of-type(3)")!.getAttribute("data-state") === "selected");
    assert.deepEqual(await states(page), ["even", "even", "selected", "even", "even", "even"]);
    // Nothing replaced: the server elements are the live ones.
    assert.equal(await page.evaluate(() => [...document.querySelectorAll("#w li")].every((li, i) => (li as HTMLElement & { __k?: number }).__k === i)), true);
    assert.deepEqual(errors, []);
  });
});
