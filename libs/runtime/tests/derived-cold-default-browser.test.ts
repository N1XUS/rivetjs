// Derived model: a cold event whose default the loader holds (submit, a submit button's / link's click, Enter's implicit
// submission) runs its handlers exactly once — on the replay — and then its default exactly once (the replayed
// `requestSubmit()` / re-dispatched link click reaches native listeners and the browser, never Rivet's delegated handlers
// a second time: RESUME-FIX A1, a cold `onSubmit` without `preventDefault` ran twice). Chromium + WebKit (WebKit where
// Playwright's WebKit is installed). Compiled with the real derived server + DOM targets (skips on a wasm without the model).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import type { Page } from "playwright";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, hasWebkit, rewrite, withPage } from "./resume/harness.ts";

// `bump` (a page global, init script) counts handler runs and the uncanceled clicks / submits a page script's document
// listener sees; the forms post into the `sink` frame (the page stays).
const SOURCE = `export function App() {
  return (
    <main>
      <iframe name="sink" />
      <form id="f" action="/sink" target="sink" onSubmit={() => bump("f")}>
        <input id="q" name="q" />
        <button id="go">Go</button>
      </form>
      <form id="g" action="/sink" target="sink" onSubmit={() => bump("g")}>
        <button id="go2" onClick={() => bump("go2")}>Go</button>
      </form>
      <a id="link" href="#done" onClick={() => bump("link")}>Link</a>
    </main>
  );
}
`;
const compiled = hasDerivedModel() ? test : test.skip;
const resume = { module: "src/page.tsx", boundaries: ["App"], independent: ["App"] };

// The lite runtime (`dom-lite.ts`, ZERO R4) replays the same held defaults: `App`'s hand-written residual (what lite
// emission produces) binds the same handlers.
const RESIDUAL = `import { _le } from "@rivetjs/runtime/dom-lite";
export function App$a(n, r) {
  const main = n.nodeType == 1 ? n : n.nextSibling, at = (id) => main.querySelector("#" + id);
  _le(r, at("f"), "submit", () => bump("f"));
  _le(r, at("g"), "submit", () => bump("g"));
  _le(r, at("go2"), "click", () => bump("go2"));
  _le(r, at("link"), "click", () => bump("link"));
}
export const App$c = () => import("/page.js");`;

async function served(lite = false): Promise<Record<string, string>> {
  const server = compile(SOURCE, { target: "server", filename: "page.tsx", resume } as never);
  const dom = compile(SOURCE, { target: "dom", filename: "page.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { App } = await importServer<{ App: () => ServerValue }>(server.code);
  const manifest = { hash: "t", runtime: lite ? "/lite.js" : "/rt.js", symbols: { "src/page.tsx#App": lite ? "/c.js" : "/page.js" } };
  const html = (await derivedToString(() => App(), { manifest })) as string;
  return {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/sink": "<!doctype html><p>sent</p>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/lite.js": 'export { default } from "/dom-lite.ts";',
    "/page.js": rewrite(dom.code),
    "/c.js": rewrite(RESIDUAL),
  };
}
const runs = (page: Page): Promise<Record<string, number>> => page.evaluate(() => (window as unknown as { runs: Record<string, number> }).runs);
// The replay chain is done: the listener recording put the native `addEventListener` back.
const idle = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => /\[native code\]/.test(Function.prototype.toString.call(EventTarget.prototype.addEventListener)), undefined, { timeout: 5000 });

// Replay done, and room for a second (wrong) run or submission to land.
const settled = async (page: Page): Promise<void> => (await idle(page), await page.waitForTimeout(300));

async function cold(engine: string, run: (page: Page, requests: string[]) => Promise<void>): Promise<void> {
  const lite = engine.endsWith("lite");
  await withPage(
    await served(lite),
    async (page, requests) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        const w = window as unknown as { runs: Record<string, number>; bump: (key: string) => void };
        w.runs = {};
        w.bump = (key) => void (w.runs[key] = (w.runs[key] ?? 0) + 1);
        // A page script's listener (there before the runtime): sees each default once, uncanceled.
        for (const type of ["click", "submit"]) document.addEventListener(type, (event) => event.defaultPrevented || w.bump(type));
      });
      await page.goto("http://rivet.test/");
      await run(page, requests);
      assert.deepEqual(errors, []);
      if (lite) assert.ok(!requests.includes("/dom-derived.ts"), "the lite runtime replayed: " + requests.join(" "));
    },
    // The event lands before the chunk: held, replayed.
    { delays: { "/page.js": 400, "/c.js": 400 }, engine: engine.startsWith("webkit") ? "webkit" : "chromium" },
  );
}
const sent = (requests: string[]): number => requests.filter((path) => path === "/sink").length;

for (const engine of ["chromium", "webkit", "chromium lite", "webkit lite"]) {
  const run = engine.startsWith("webkit") && !hasWebkit() ? test.skip : compiled;

  run(`${engine}: a cold submit button click runs onSubmit once, then submits once`, async () => {
    await cold(engine, async (page, requests) => {
      await page.click("#go");
      await page.waitForFunction(() => (window as unknown as { runs: Record<string, number> }).runs.f, undefined, { timeout: 5000 });
      await settled(page);
      assert.deepEqual(await runs(page), { f: 1, submit: 1 });
      assert.equal(sent(requests), 1, requests.join(" "));
    });
  });

  run(`${engine}: a cold submit button with its own onClick runs onClick and onSubmit once each, then submits once`, async () => {
    await cold(engine, async (page, requests) => {
      await page.click("#go2");
      await page.waitForFunction(() => (window as unknown as { runs: Record<string, number> }).runs.g, undefined, { timeout: 5000 });
      await settled(page);
      assert.deepEqual(await runs(page), { go2: 1, g: 1, submit: 1 });
      assert.equal(sent(requests), 1, requests.join(" "));
    });
  });

  run(`${engine}: a cold Enter in a text field (implicit submission) runs onSubmit once, then submits once`, async () => {
    await cold(engine, async (page, requests) => {
      await page.focus("#q");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => (window as unknown as { runs: Record<string, number> }).runs.f, undefined, { timeout: 5000 });
      await settled(page);
      assert.deepEqual(await runs(page), { f: 1, submit: 1 });
      assert.equal(sent(requests), 1, requests.join(" "));
    });
  });

  run(`${engine}: a cold form.requestSubmit() (a held submit) runs onSubmit once, then submits once`, async () => {
    await cold(engine, async (page, requests) => {
      await page.evaluate(() => (document.querySelector("#f") as HTMLFormElement).requestSubmit());
      await page.waitForFunction(() => (window as unknown as { runs: Record<string, number> }).runs.f, undefined, { timeout: 5000 });
      await settled(page);
      assert.deepEqual(await runs(page), { f: 1, submit: 1 });
      assert.equal(sent(requests), 1, requests.join(" "));
    });
  });

  run(`${engine}: a cold link click runs onClick once, then navigates`, async () => {
    await cold(engine, async (page) => {
      await page.click("#link");
      await page.waitForFunction(() => location.hash === "#done", undefined, { timeout: 5000 });
      await settled(page);
      assert.deepEqual(await runs(page), { link: 1, click: 1 });
    });
  });
}
