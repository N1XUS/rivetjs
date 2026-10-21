// LAZY-T6 (spec docs/design/specs/2026-10-19-lazy-collection-rows-design.md §3.2 item 5): a lazy row that reads a keyed
// selector (`selector(signal, fn, { keys: memberKeys })`, cdk `selectionOf` / `isFocusedKey`) is recorded per key (entry
// `keyed` [12], `_trackReads` keyed hook) and wakes only when its key may flip — a selection change materialises the rows
// whose membership changed, not every row of the For. Rows of one structure adopt through the For's row plan (no probe run);
// markup, ids and node identity are kept either way.
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { LazyRowsEntry, ResumeState } from "@rivetjs/runtime/resume-format";
import { withIdScope } from "@rivetjs/runtime/id";
import type { Page } from "playwright";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { LAZY_ROWS_BUILD, withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type R = { id: number; label: string };
const source = `import { For } from "@rivetjs/runtime/dom";
import { signal, selector, memberKeys } from "@rivetjs/reactivity";
import { createId } from "@rivetjs/runtime/id";
const selectors = new WeakMap();
// cdk \`selectionOf\` shape: one selector per selection signal, in a module WeakMap (never captured).
function isOn(sel, key) {
  let s = selectors.get(sel);
  if (!s) selectors.set(sel, (s = selector(sel, (k, v) => v === "all" || v.has(k), { keys: memberKeys })));
  return s(key);
}
const hinted = new WeakMap();
// A selector whose hint resume does not know: its rows read the signal (whole-For wake).
function isHinted(sel, key) {
  let s = hinted.get(sel);
  if (!s) hinted.set(sel, (s = selector(sel, (k, v) => v === "all" || v.has(k), { keys: () => null })));
  return s(key);
}
export function Page(p) {
  const sel = signal(new Set([3]));
  const focus = signal(null);
  return <main>
    <button id="all" onClick={() => sel.set("all")}>all</button>
    <button id="none" onClick={() => sel.set(new Set())}>none</button>
    <table id="t"><tbody><For each={() => p.rows} by={(r) => r.id}>{(row) =>
      <tr id={createId()} class={isOn(sel, row().id) ? "on" : "off"} data-focus={focus() === row().id ? "" : undefined}>
        <td>{row().label}</td>
        <td><button class="pick" onClick={() => sel.set(new Set([row().id]))}>x</button></td>
      </tr>}</For></tbody></table>
    <ul id="h"><For each={() => p.rows} by={(r) => r.id}>{(row) =>
      <li class={isHinted(sel, row().id) ? "on" : "off"}>{row().label}</li>}</For></ul>
    <ol id="o"><For each={() => p.rows} by={(r) => r.id} lazy={() => p.rows.length > 100}>{(row) =>
      <li onClick={() => sel.set(new Set([row().id]))}>{row().label}</li>}</For></ol>
    <ol id="f"><For each={() => p.rows} by={(r) => r.id} lazy={false}>{(row) =>
      <li onClick={() => sel.set(new Set([row().id]))}>{row().label}</li>}</For></ol>
  </main>;
}`;
const dom = compileResume(source, "dom", "src/t6.tsx");
const mod = await importServer<{ Page(p: { rows: R[] }): ServerValue }>(compileResume(source, "server", "src/t6.tsx").code);
const manifest: ResumeManifest = {
  hash: "t6",
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

const handled = (page: Page): Promise<boolean[]> =>
  page.evaluate(() => [...document.querySelectorAll("#t .pick")].map((el) => typeof (el as unknown as { $$click?: unknown }).$$click === "function"));
const classes = (page: Page, s: string): Promise<string[]> => page.evaluate((s) => [...document.querySelectorAll(s)].map((el) => el.className), s);
const mark = (page: Page): Promise<void> =>
  page.evaluate(() => document.querySelectorAll("#t *").forEach((el, i) => ((el as unknown as { __m: number }).__m = i)));
const unmarked = (page: Page): Promise<string[]> =>
  page.evaluate(() => [...document.querySelectorAll("#t *")].filter((el) => (el as unknown as { __m?: number }).__m === undefined).map((el) => el.outerHTML));

test("server: keyed selector reads ship per key (entry [12], own keys = 1); the plain read and an unknown hint stay in `reads`", () => {
  const [table, list, ...rest] = state.L as LazyRowsEntry[];
  assert.ok(table && list);
  // `lazy={() => false}` / `lazy={false}` (the cdk opt-out for a For whose rows hold nested collections): recorded rows.
  assert.equal(rest.length, 0);
  // The table's rows read `isOn(sel, id)` (keyed, every row its own key) and `focus` (plain).
  const keyed = table[12] as unknown[];
  assert.equal(keyed.length, 3);
  assert.deepEqual(keyed.slice(1), [1, 1]);
  assert.equal((table[7] as number[]).length, 1, "only `focus` is a plain read");
  assert.ok(!(table[7] as number[]).includes(keyed[0] as number), "the keyed signal is not a plain read");
  // The hinted selector is not known to resume: its rows read `sel` itself (whole wake), no keyed slot.
  assert.deepEqual(list[7], [keyed[0]]);
  assert.equal(list[12], undefined);
});

test("browser: a selection change materialises only the rows whose key flipped; select-all wakes every row; nothing is replaced", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (m) => m.type() === "warning" && errors.push(m.text()));
    await page.goto("http://rivet.test/");
    await mark(page);
    const ids = await page.evaluate(() => [...document.querySelectorAll("#t tr")].map((tr) => tr.id));
    assert.deepEqual(await classes(page, "#t tr"), ["off", "off", "on", "off", "off", "off"]);
    await page.click("#t tr:nth-of-type(5) .pick");
    await page.waitForFunction(() => document.querySelector("#t tr:nth-of-type(5)")!.className === "on");
    // Row 5 (the event) and row 3 (deselected: its key flipped) materialised; the rest stay inert server markup.
    assert.deepEqual(await classes(page, "#t tr"), ["off", "off", "off", "off", "on", "off"]);
    assert.deepEqual(await handled(page), [false, false, true, false, true, false]);
    // The other For reads `sel` through a selector resume does not know: its first change woke all of its rows.
    assert.deepEqual(await classes(page, "#h li"), ["off", "off", "off", "off", "on", "off"]);
    await page.click("#t tr:nth-of-type(2) .pick");
    await page.waitForFunction(() => document.querySelector("#t tr:nth-of-type(2)")!.className === "on");
    assert.deepEqual(await handled(page), [false, true, true, false, true, false]);
    await page.click("#all");
    await page.waitForFunction(() => [...document.querySelectorAll("#t tr")].every((tr) => tr.className === "on"));
    assert.deepEqual(await handled(page), [true, true, true, true, true, true]);
    await page.click("#none");
    await page.waitForFunction(() => [...document.querySelectorAll("#t tr")].every((tr) => tr.className === "off"));
    // The opted-out Fors resumed recorded rows: their handlers work without a materialisation.
    await page.click("#o li:nth-of-type(4)");
    await page.waitForFunction(() => document.querySelector("#t tr:nth-of-type(4)")!.className === "on");
    await page.click("#f li:nth-of-type(6)");
    await page.waitForFunction(() => document.querySelector("#t tr:nth-of-type(6)")!.className === "on");
    await page.click("#none");
    await page.waitForFunction(() => [...document.querySelectorAll("#t tr")].every((tr) => tr.className === "off"));
    // Row plans and probes alike adopt the server nodes: none replaced, ids replayed.
    assert.deepEqual(await unmarked(page), []);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#t tr")].map((tr) => tr.id)), ids);
    assert.deepEqual(errors, []);
  });
});
