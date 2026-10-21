// LAZY-ROWS T4 + T5: a page whose state carries lazy row records (`L`, `RIVET_LAZY_ROWS=on`) boots; a click in a lazy
// row materialises it (its handler runs: T5), streamed segments' rows too; a region holding lazy rows re-creates its For on
// the first change (the For keys the server rows); nothing throws. A streamed segment's records are merged into the parsed
// state. The adopt-mode details: `resume-lazy-materialise-browser.test.ts`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderResumable, resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { ResumeState } from "@rivetjs/runtime/resume-format";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { LAZY_ROWS_BUILD, withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
const source = `import { For } from "@rivetjs/runtime/dom";
import { Async } from "@rivetjs/runtime/server";
import { signal } from "@rivetjs/reactivity";
const fixed = [{ id: 1, label: "s1" }, { id: 2, label: "s2" }];
const later = () => (globalThis as any).__later ? (globalThis as any).__later() : Promise.resolve(fixed);
export function Page() {
  const n = signal(0);
  const list = signal([{ id: 1, label: "a" }, { id: 2, label: "b" }]);
  return <main>
    <button id="top" onClick={() => n.set(n() + 1)}>{n()}</button>
    <button id="add" onClick={() => list.set([...list(), { id: 3, label: "c" }])}>add</button>
    <ul id="static"><For each={() => fixed} by={(r) => r.id}>{(row) => <li onClick={() => n.set(row().id * 10)}>{row().label}</li>}</For></ul>
    <ul id="live"><For each={list} by={(r) => r.id}>{(row) => <li onClick={() => n.set(row().id * 100)}>{row().label}</li>}</For></ul>
    <section id="late"><Async load={later} fallback={() => <i>wait</i>}>{(v) =>
      <ol><For each={() => v} by={(r) => r.id}>{(row) => <li onClick={() => n.set(row().id * 1000)}>{row().label}</li>}</For></ol>}</Async></section>
  </main>;
}`;
const dom = compileResume(source, "dom", "src/lazy.tsx");
const mod = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/lazy.tsx").code);
const manifest: ResumeManifest = {
  hash: "lazy",
  runtime: "/rt.js",
  symbols: symbolUrls(dom.symbols),
  lazyRows: "/dom-resume-lazy.ts",
};
const byComponent = symbolChunks(dom.symbols);

test("lazy row records (RIVET_LAZY_ROWS=on): the page boots, regions re-create their lazy rows, streamed records merge", async () => {
  process.env.RIVET_LAZY_ROWS = "on";
  let html: string;
  try {
    const chunks: string[] = [];
    (globalThis as { __later?: () => Promise<unknown> }).__later = () => new Promise((resolve) => setTimeout(() => resolve([{ id: 7, label: "z" }]), 5));
    await renderResumable(() => mod.Page(), { write: (chunk) => void chunks.push(chunk) }, { manifest, stream: {} });
    html = chunks.join("");
  } finally {
    delete process.env.RIVET_LAZY_ROWS;
    delete (globalThis as { __later?: unknown }).__later;
  }
  const shell = JSON.parse(/<script type="rivet\/state" data-region="0"[^>]*>(.*?)<\/script>/s.exec(html)![1]!) as ResumeState;
  assert.equal(shell.L?.length, 2);
  assert.match(html, /data-patch="\d+">[^<]*"L":\[/);
  const files: Record<string, Served> = {
    "/fixture.mjs": rewrite(dom.code),
    ...LAZY_ROWS_BUILD,
    "/rt.js":
      'import { createResume } from "/dom-resume.ts"; import { _lazyReady } from "/lazy-rows-resume.ts"; export default createResume({}); await _lazyReady?.();',
    "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
  };
  Object.assign(files, symbolModules(byComponent));
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    const text = (selector: string, value: string) =>
      page.waitForFunction(([s, v]) => document.querySelector(s!)?.textContent === v, [selector, value], { timeout: 5000 });
    await text("#late li", "z");
    // The stream add-on merged the segment's record into the parsed state (before the runtime saw the patch).
    assert.equal(await page.evaluate(() => (document as unknown as { $r: { p(): { L: unknown[] } } }).$r.p().L.length), 3);
    await page.click("#top");
    await text("#top", "1");
    // Lazy rows materialise on their first event: the row's own handler runs (T5).
    await page.click("#static li");
    await text("#top", "10");
    await page.click("#late li");
    await text("#top", "7000");
    await page.click("#top");
    await text("#top", "7001");
    // A region holding lazy rows: its first change re-creates them in the browser (client rows, working handlers).
    await page.click("#add");
    await page.waitForFunction(() => document.querySelectorAll("#live li").length === 3, undefined, { timeout: 5000 });
    await page.click("#live li:nth-child(3)");
    await text("#top", "300");
    assert.deepEqual(errors, []);
  });
});
