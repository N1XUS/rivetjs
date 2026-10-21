// LAZY-BLOCKERS (2026-10-21): the flip-only story failures of `resume.lazyRows`, as runtime cases.
// - Cold key events: a key event dispatched before the runtime started, replayed after a handler moved focus to another
//   lazy row, runs on the focused row (materialised, its client-delegated handlers) — before: on the old path's row
//   (cdk Tabs manual activation: Enter after the arrow keys).
// - A cold replay's delegated handler canceling the event stops the held default's replay (ui CheckboxButtonGroup: the
//   label's `onClick` preventDefault + press toggle, then the replayed label activation toggled the input back).
// - Rows reading a signal evaluate their row chunks when the runtime starts (a write then wakes them in the writer's
//   flush: cdk Tabs panels, masonry selection), and their chunks are their readers' extras in the preload plan.
// - A write through `set` materialises the rows it wakes before the value changes (cdk SelectionIndicator: the row losing
//   the selection adopted already deselected, its server indicator never became a live instance to move from).
// - The lazy rows runtime is a chunk of its own (`dom-resume-lazy.ts`): a page without `L` entries never loads it; a page
//   with them preloads it at the first event walk (the lazy add-on's `data-lz`, manifest `lazyRows` = its URL).
import { test, vi } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { LazyRowsEntry, ResumeState } from "@rivetjs/runtime/resume-format";
import { withIdScope } from "@rivetjs/runtime/id";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { LAZY_ROWS_BUILD, withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

// The server switch of `resume.lazyRows` builds (mocked on, as the plugin serves it): the lazy preload plan.
vi.mock("../lazy-rows.ts", () => ({ LAZY_ROWS: true }));

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type R = { id: number; label: string };
const source = `import { For } from "@rivetjs/runtime/dom";
import { signal, selector, memberKeys, untrack } from "@rivetjs/reactivity";
const selectors = new WeakMap();
function isOn(sel, key) {
  let s = selectors.get(sel);
  if (!s) selectors.set(sel, (s = selector(sel, (k, v) => v.has(k), { keys: memberKeys })));
  return s(key);
}
const log = (globalThis.__log ??= []);
export function Other() {
  return <button id="other" onClick={() => (globalThis.__other = 1)}>other</button>;
}
export function List(p) {
  return <>
    <ol id="l"><For each={() => p.rows} by={(r) => r.id}>{(row) => {
      log.push(row().id + ":" + untrack(() => p.sel().has(row().id)));
      return <li class={isOn(p.sel, row().id) ? "on" : "off"}>{row().label}</li>;
    }}</For></ol>
  </>;
}
export function Page(p) {
  const out = signal("");
  const sel = signal(new Set([3]));
  return <main>
    <p id="out">{out()}</p>
    <ul id="k"><For each={() => p.rows} by={(r) => r.id}>{(row) =>
      <li><button class="k" onKeyDown={(e) => {
        if (e.key === "ArrowDown") e.currentTarget.parentElement.nextElementSibling.querySelector("button").focus();
        else if (e.key === "Enter") out.set("enter " + row().label);
      }}>{row().label}</button></li>}</For></ul>
    <ul id="c"><For each={() => p.rows} by={(r) => r.id}>{(row) =>
      <li><label class="c" onClick={(e) => { e.preventDefault(); out.set("label " + row().label); }}><input type="checkbox" onChange={() => out.set("changed " + row().label)} />{row().label}</label></li>}</For></ul>
    <Other />
    <button id="pick5" onClick={() => sel.set(new Set([5]))}>5</button>
    <List rows={p.rows} sel={sel} />
  </main>;
}`;
const dom = compileResume(source, "dom", "src/blockers.tsx");
const mod = await importServer<{ Page(p: { rows: R[] }): ServerValue; Other(): ServerValue }>(compileResume(source, "server", "src/blockers.tsx").code);
const manifest: ResumeManifest = {
  hash: "blockers",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
  lazyRows: "/dom-resume-lazy.ts",
};
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const rows: R[] = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, label: "row " + (i + 1) }));
process.env.RIVET_LAZY_ROWS = "on";
let body: string, plain: string;
try {
  body = (await resumableToString(() => withIdScope("rv", () => mod.Page({ rows })), { manifest })) as string;
  plain = (await resumableToString(() => withIdScope("rv", () => mod.Other()), { manifest })) as string;
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
  "/plain": "<!doctype html><html><head></head><body>" + plain + "</body></html>",
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
const listFor = (): LazyRowsEntry => (state.L as LazyRowsEntry[]).find((e) => e[12])!;
const out = (page: import("playwright").Page): Promise<string> => page.evaluate(() => document.querySelector("#out")!.textContent!);

test("server: every For is lazy; the keyed list's row chunk is an extra of the handler writing its selection (`lazyReaders`)", () => {
  assert.equal((state.L as LazyRowsEntry[]).length, 3);
  const list = listFor();
  const pick = Object.values(state.e).find((h) => h.click && h.click[1].length)!.click!;
  assert.ok(!pick[2].includes(state.c.indexOf("/c/List.js")), "the writer's own chunks are not the rows'");
  for (const i of list[6]) assert.ok([...pick[2], ...(pick[3] ?? [])].includes(i), "row chunk " + state.c[i] + " loads with the writer");
});

test("browser: cold Enter after a cold ArrowDown moved focus runs on the focused lazy row", async () => {
  let boot!: () => void;
  const held = new Promise<void>((resolve) => (boot = resolve));
  await withPage(
    files,
    async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/");
      await page.focus("#k li:nth-of-type(1) button");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      boot();
      await page.waitForFunction(() => document.querySelector("#out")!.textContent !== "");
      assert.equal(await out(page), "enter row 2");
      assert.equal(await page.evaluate(() => document.activeElement!.textContent), "row 2");
      assert.deepEqual(errors, []);
    },
    { delays: { "/rt.js": held } },
  );
});

test("browser: a cold click a lazy row's handler canceled does not replay its default (no second toggle)", async () => {
  let boot!: () => void;
  const held = new Promise<void>((resolve) => (boot = resolve));
  await withPage(
    files,
    async (page) => {
      await page.goto("http://rivet.test/");
      await page.click("#c li:nth-of-type(2) label");
      boot();
      await page.waitForFunction(() => document.querySelector("#out")!.textContent !== "");
      await page.waitForTimeout(100);
      assert.equal(await out(page), "label row 2");
      assert.equal(await page.evaluate(() => document.querySelector<HTMLInputElement>("#c li:nth-of-type(2) input")!.checked), false);
    },
    { delays: { "/rt.js": held } },
  );
});

test("browser: rows reading a signal load their row chunk at start; a `set` wakes them before the value changes", async () => {
  await withPage(files, async (page, requests) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    await page.evaluate(() => ((globalThis as { __log?: string[] }).__log ??= []).splice(0));
    assert.equal(requests.includes("/c/List.js"), false, "rows without handlers: nothing planned before input");
    // The first interaction (a handler writing nothing the rows read) starts the runtime: the list's chunk loads.
    await page.click("#other");
    await page.waitForFunction(() => (globalThis as { __other?: number }).__other === 1);
    await page.waitForFunction(() => performance.getEntriesByType("resource").some((r) => r.name.endsWith("/c/List.js")));
    await page.click("#pick5");
    await page.waitForFunction(() => document.querySelector("#l li:nth-of-type(5)")!.className === "on");
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#l li")].map((li) => li.className)), ["off", "off", "off", "off", "on", "off"]);
    // Rows 3 (deselected) and 5 (selected) adopted with the values the server rendered them from.
    assert.deepEqual([...new Set(await page.evaluate(() => (globalThis as { __log?: string[] }).__log!))].sort(), ["3:true", "5:false"]);
    assert.deepEqual(errors, []);
  });
});

test("server: the lazy add-on names the lazy rows chunk (`data-lz`) on pages with `L` entries only", () => {
  assert.match(body, /<script data-lz="\/dom-resume-lazy\.ts">/);
  assert.equal(plain.includes("data-lz"), false);
  assert.equal(plain.includes('"L":'), false);
});

test("browser: the lazy rows chunk loads only on a page with `L` entries, preloaded at the first event walk", async () => {
  await withPage(files, async (page, requests) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/plain");
    await page.click("#other");
    await page.waitForFunction(() => (globalThis as { __other?: number }).__other === 1);
    assert.ok(requests.includes("/rt.js"), "the runtime started");
    assert.equal(requests.includes("/dom-resume-lazy.ts"), false, "no lazy rows: no lazy rows runtime");
    await page.goto("http://rivet.test/");
    assert.equal(await page.evaluate(() => !!document.querySelector('link[href="/dom-resume-lazy.ts"]')), false, "nothing before input");
    await page.click("#other");
    await page.waitForFunction(() => (globalThis as { __other?: number }).__other === 1);
    assert.equal(await page.evaluate(() => document.querySelector<HTMLLinkElement>('link[href="/dom-resume-lazy.ts"]')?.rel), "modulepreload");
    await page.click("#pick5");
    await page.waitForFunction(() => document.querySelector("#l li:nth-of-type(5)")!.className === "on");
    assert.deepEqual(errors, []);
  });
});
