// Resume client hardening: one document query for every `data-r` lookup of a burst of binding
// activations (C2), `currentTarget` as a data property in resumed handlers (C14), and development
// observability — region re-creation events / logs, drift hints for missing row markers, failed chunk
// loads the loader's warm-up swallows (D3).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { DEV_BUILD, withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";
import type { Page as BrowserPage } from "playwright";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = await readFile(new URL("./resume/hardening-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/hardening.tsx");
const server = await importServer<{ Page(props: { items: { id: number }[] }): ServerValue }>(compileResume(source, "server", "src/hardening.tsx").code);
const manifest: ResumeManifest = {
  hash: "hardening",
  runtime: "/rt.js",
  // The loader module: scheduled prefetch and the idle evaluation of prefetched chunks (the warm-up below).
  loader: "/resume-loader-module.ts",
  symbols: symbolUrls(dom.symbols),
};
const html = await resumableToString(() => server.Page({ items: Array.from({ length: 100 }, (_, id) => ({ id })) }), { manifest });
const byComponent = symbolChunks(dom.symbols);
const base: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
};
for (const [path, symbols] of Object.entries(byComponent)) base[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
// Development build of `#dev` (the harness serves the production `off.ts` at this path).
const development: Record<string, Served> = {
  ...base,
  ...DEV_BUILD,
};

const collect = (page: BrowserPage) => {
  const errors: string[] = [],
    console: { type: string; text: string }[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => console.push({ type: message.type(), text: message.text() }));
  return { errors, console };
};
const boot = async (page: BrowserPage) => {
  await page.goto("http://rivet.test/");
  await page.click("#probe");
  await page.waitForFunction(() => document.querySelector("#seen")!.textContent !== "", undefined, { timeout: 3000 });
};

test("resume: a burst of attribute binding activations resolves its elements with one document query", async () => {
  await withPage(base, async (page) => {
    const { errors } = collect(page);
    await page.addInitScript(() => {
      const w = window as unknown as { __lookups: number };
      w.__lookups = 0;
      const one = Document.prototype.querySelector;
      Document.prototype.querySelector = function (this: Document, selector: string) {
        if (selector.startsWith("[data-r=")) w.__lookups++;
        return one.call(this, selector);
      } as typeof one;
      const all = Document.prototype.querySelectorAll;
      Document.prototype.querySelectorAll = function (this: Document, selector: string) {
        if (selector === "[data-r]") w.__lookups++;
        return all.call(this, selector);
      } as typeof all;
    });
    await boot(page);
    await page.evaluate(() => ((window as unknown as { __lookups: number }).__lookups = 0));
    // The first change of `picked` activates the class binding of all 100 rows.
    await page.click("#rows li:nth-child(6) .pick");
    await page.waitForFunction(() => document.querySelector("#rows li:nth-child(6)")!.className === "row sel", undefined, { timeout: 3000 });
    const lookups = await page.evaluate(() => (window as unknown as { __lookups: number }).__lookups);
    assert.ok(lookups <= 1, `${lookups} document queries for 100 row bindings`);
    await page.click("#rows li:nth-child(9) .pick");
    await page.waitForFunction(() => document.querySelector("#rows li:nth-child(9)")!.className === "row sel", undefined, { timeout: 3000 });
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#rows li.sel")].map((li) => li.getAttribute("data-id"))), ["8"]);
    // A row the keyed list re-created (dropped, so its bindings are gone) does not break later lookups.
    await page.click("#fewer");
    await page.waitForFunction(() => document.querySelectorAll("#rows li").length === 99, undefined, { timeout: 3000 });
    await page.click("#rows li:nth-child(2) .pick");
    await page.waitForFunction(() => document.querySelector("#rows li:nth-child(2)")!.className === "row sel", undefined, { timeout: 3000 });
    assert.deepEqual(errors, []);
  });
});

test("resume: a resumed handler sees currentTarget as a data property, restored after the call", async () => {
  await withPage(base, async (page) => {
    const { errors } = collect(page);
    await boot(page);
    assert.equal(await page.textContent("#seen"), "probe:true");
    assert.deepEqual(errors, []);
  });
});

test("development: a region re-creation is reported with its component and cause, once per symbol in the console", async () => {
  await withPage(development, async (page) => {
    const { errors, console } = collect(page);
    await page.addInitScript(() => {
      const events: [string, Record<string, unknown>][] = ((window as unknown as { __events: unknown[] }).__events = []);
      (window as unknown as Record<symbol, unknown>)[Symbol.for("rivet.devtools")] = {
        emit: (type: string, data: Record<string, unknown>) => events.push([type, data]),
      };
    });
    await boot(page);
    await page.click("#toggle");
    await page.waitForSelector("#open", { timeout: 3000 });
    await page.click("#toggle");
    await page.waitForSelector("#closed", { timeout: 3000 });
    // The keyed list may already have adopted its rows speculatively at idle (mode "adopted").
    const events = () =>
      page.evaluate(() =>
        (window as unknown as { __events: [string, Record<string, unknown>][] }).__events.filter(([type]) => type === "resume.region").map(([, data]) => data),
      );
    const regions = (await events()).filter((data) => data.mode === "recreated");
    assert.equal(regions.length, 1, JSON.stringify(regions));
    assert.equal(regions[0]!.component, "Page");
    assert.equal(regions[0]!.mode, "recreated");
    assert.match(String(regions[0]!.symbol), /^src\/hardening\.tsx#Page\$\w+$/);
    assert.match(String(regions[0]!.cause), /^the first change of signal #\d+ \(now true\)$/);
    const logs = console.filter((entry) => entry.text.startsWith("Rivet resume: Page re-created region"));
    assert.equal(logs.length, 1);
    assert.equal(logs[0]!.type, "info");
    // The keyed list adopts its rows: reported as adopted, not logged.
    await page.click("#fewer");
    await page.waitForFunction(() => document.querySelectorAll("#rows li").length === 99, undefined, { timeout: 3000 });
    // One list region, adopted once (speculatively at idle, or by this change).
    const adopted = (await events()).filter((data) => data.mode === "adopted");
    assert.equal(adopted.length, 1, JSON.stringify(adopted));
    assert.equal((await events()).filter((data) => data.mode === "recreated").length, 1);
    assert.equal(console.filter((entry) => entry.text.startsWith("Rivet resume: Page re-created")).length, 1);
    assert.deepEqual(errors, []);
  });
});

test("development: a keyed list row whose markers were removed fails with the drift hint", async () => {
  await withPage(development, async (page) => {
    collect(page);
    await page.goto("http://rivet.test/");
    await page.evaluate(() => {
      // Remove the markers of the third row (an extension or HTML rewriter would), before resume starts.
      const li = document.querySelector("#rows li:nth-child(3)")!;
      for (const node of [li.previousSibling, li.nextSibling]) if (node?.nodeType === 8) node.remove();
      document.addEventListener("rivet:resume-error", (event) => {
        (window as unknown as { __drift?: string }).__drift ??= String(((event as CustomEvent).detail as { error: Error }).error.message);
      });
    });
    await page.click("#probe");
    await page.click("#fewer");
    await page.waitForFunction(() => (window as unknown as { __drift?: string }).__drift, undefined, { timeout: 3000 });
    const message = await page.evaluate(() => (window as unknown as { __drift: string }).__drift);
    assert.match(message, /^Missing resumable row \d+ of region \d+ — the HTML changed between the server render and resume/);
  });
});

test("development: a chunk that fails while the loader warms it up is logged", async () => {
  await withPage({ ...development, "/c/Extra.js": 'throw new Error("broken chunk");' }, async (page) => {
    const { console } = collect(page);
    await boot(page);
    // Hover: the loader prefetches Extra's chunk and evaluates it at idle (its error is swallowed there).
    await page.hover("#extra");
    await page.waitForFunction(() => document.querySelector('link[rel="modulepreload"][href$="/c/Extra.js"]'), undefined, { timeout: 3000 });
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && !console.some((entry) => entry.text.startsWith("Rivet resume: chunk /c/Extra.js failed"))) await page.waitForTimeout(50);
    const log = console.find((entry) => entry.text.startsWith("Rivet resume: chunk /c/Extra.js failed to load or evaluate"));
    assert.ok(log, JSON.stringify(console));
    assert.equal(log.type, "warning");
  });
});
