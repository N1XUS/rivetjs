// UI-CHAT-RED (2026-10-22): a lazy row's `_regionState` values go to the browser's row run by position, but the server
// renders a row's nested content (child / attribute sites, Show / Switch branches, slot content) in document order while
// the browser creates it in insertion order — a component's children array creates its components first and inserts
// the Show's branch after them. Shipped by position, the keyed Show's signal became the next component's state object
// (ui-docs `showcase-chat`: a ChatTool disclosure signal adopted as a ChatSource's TooltipTrigger state, "state.isOpen
// is not a function"). Only values the row creates directly ship (`server-resume-lazy.ts` `lazyLocal`) and adopt
// (`dom-resume-lazy.ts` `enterRow`, `direct`); nested ones are created afresh.
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { ResumeState } from "@rivetjs/runtime/resume-format";
import { withIdScope } from "@rivetjs/runtime/id";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { LAZY_ROWS_BUILD, withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type R = { id: number; on: boolean };
const source = `import { For, Show, clientEffect } from "@rivetjs/runtime/dom";
import { signal, _regionState } from "@rivetjs/reactivity";
// The browser renders with a bias: a value created afresh shows it, an adopted one does not.
const bias = () => globalThis.__bias ?? 0;
// Branch content: its signal is created inside the Show (nested in the row).
function Flag(p) {
  const s = _regionState(() => signal(p.id * 100 + bias()));
  return <i class="flag">{s()}</i>;
}
// A state object (methods on it), created inside the component's children site: nested too.
function Pill(p) {
  const st = _regionState(() => {
    const open = signal(false);
    return { open, toggle: () => open.set(!open()) };
  });
  return <button class="pill" onClick={() => st.toggle()}>{st.open() ? "open" : "closed"}</button>;
}
function Box(p) {
  return <div class="box">{p.children}</div>;
}
// Created directly by the row (the row function's component body): adopted.
function Row(p) {
  const n = _regionState(() => signal(p.row().id * 10 + bias()));
  if (p.row().id === 2) clientEffect(() => void (globalThis.__fx = (globalThis.__fx ?? 0) + 1));
  return <li data-id={p.row().id}>
    <button class="inc" onClick={() => n.set(n() + 1)}>{n()}</button>
    <Box>
      <Show when={p.row().on}><Flag id={p.row().id} /></Show>
      <Box><Pill /></Box>
    </Box>
  </li>;
}
export function Page(p) {
  return <ul id="u"><For each={() => p.rows} by={(r) => r.id}>{(row) => <Row row={row} />}</For></ul>;
}`;
const dom = compileResume(source, "dom", "src/nested.tsx");
const mod = await importServer<{ Page(p: { rows: R[] }): ServerValue }>(compileResume(source, "server", "src/nested.tsx").code);
const manifest: ResumeManifest = { hash: "nested", runtime: "/rt.js", symbols: symbolUrls(dom.symbols), lazyRows: "/dom-resume-lazy.ts" };
const rows: R[] = [
  { id: 1, on: false },
  { id: 2, on: true },
  { id: 3, on: true },
];
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
Object.assign(files, symbolModules(symbolChunks(dom.symbols)));

test("server: a lazy row ships only the _regionState values it creates directly (the Show branch's and the children site's are nested)", () => {
  assert.equal(state.L?.length, 1, "the For is lazy");
  // Entry [8]: `[k, { l: [ref, …] }, …]` — one direct value (Row's `n`) per row.
  const perRow = state.L![0]![8] as unknown[];
  assert.ok(Array.isArray(perRow));
  for (let i = 0; i < perRow.length; i += 2) assert.equal((perRow[i + 1] as { l: unknown[] }).l.length, 1, "row " + perRow[i] + ": only `n`");
});

test("browser: rows materialise with the direct value adopted and nested values created afresh, in either order", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => void (message.type() === "error" && errors.push(message.text())));
    await page.addInitScript(() => ((globalThis as unknown as { __bias: number }).__bias = 1000));
    await page.goto("http://rivet.test/");
    // Row 2 holds a client effect: it materialises at idle (the run that adopted the keyed Show's signal as Pill's state).
    await page.waitForFunction(() => (globalThis as unknown as { __fx?: number }).__fx === 1);
    // Pill's state is its own object (methods work); Flag's signal was created afresh (the bias shows), as a Show branch's
    // value on a recorded page.
    await page.click("#u li:nth-of-type(2) .pill");
    await page.waitForFunction(() => document.querySelector("#u li:nth-of-type(2) .pill")?.textContent === "open");
    assert.equal(await page.textContent("#u li:nth-of-type(2) .flag"), "1200");
    // `n` adopted: 20 (server) + 1; a browser-created value would start at 1020.
    await page.click("#u li:nth-of-type(2) .inc");
    await page.waitForFunction(() => document.querySelector("#u li:nth-of-type(2) .inc")?.textContent === "21");
    // Row 3 materialises on its click (cold path), same rules.
    await page.click("#u li:nth-of-type(3) .pill");
    await page.waitForFunction(() => document.querySelector("#u li:nth-of-type(3) .pill")?.textContent === "open");
    await page.click("#u li:nth-of-type(3) .inc");
    await page.waitForFunction(() => document.querySelector("#u li:nth-of-type(3) .inc")?.textContent === "31");
    // Row 1 (no branch): its Pill is the only nested value.
    await page.click("#u li:nth-of-type(1) .pill");
    await page.waitForFunction(() => document.querySelector("#u li:nth-of-type(1) .pill")?.textContent === "open");
    assert.deepEqual(errors, []);
  });
});
