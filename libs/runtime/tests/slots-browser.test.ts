// Slots in the browser: CSR mount (lazy slot props, scoped slots, context from the render site) and
// resume (a child region re-creates parent slot content without running either component).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compile } from "@rivetjs/compiler";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
interface TestWindow {
  __kept?: boolean;
  __componentRuns?: unknown;
}

const source = await readFile(new URL("./resume/slots-fixture.tsx", import.meta.url), "utf8");
const csr = compile(source, { target: "dom", filename: "slots-fixture.tsx" });
assert.deepEqual(csr.diagnostics, []);
const dom = compileResume(source, "dom", "src/slots.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/slots.tsx").code);
const byComponent = symbolChunks(dom.symbols);
const manifest: ResumeManifest = {
  hash: "slots",
  runtime: "/rt.js",
  symbols: symbolUrls(dom.symbols),
};
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/csr.mjs": rewrite(csr.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/csr": `<!doctype html><html><body><div id="app"></div><script type="module">
    import { mount } from "/dom.ts"; import { Page, Context } from "/csr.mjs";
    mount(() => [Page(), Context()], document.getElementById("app"));
  </script></body></html>`,
  "/": "<!doctype html><html><head></head><body>" + (await resumableToString(() => server.Page(), { manifest })) + "</body></html>",
};
Object.assign(files, symbolModules(byComponent));

const text = (selector: string) => `document.querySelector(${JSON.stringify(selector)})?.textContent`;

test("CSR: named, default (function child), scoped slots and fallbacks; slot content updates and sees child context", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/csr");
    await page.waitForFunction(() => document.querySelector("#title"));
    assert.equal((await page.textContent("#title"))!.trim(), "Hello");
    assert.equal(await page.$("#body"), null);
    await page.click("#toggle");
    await page.waitForFunction(() => document.querySelector("#foot"));
    assert.equal((await page.textContent("#n"))!.trim(), "1");
    await page.click("#inc");
    await page.waitForFunction(`${text("#n")} === "2"`);
    await page.waitForFunction(`${text("#foot")}.trim() === "2 items"`);
    assert.deepEqual(await page.$$eval("#rows li", (lis) => lis.map((li) => li.textContent)), ["0:a", "1:b"]);
    await page.click("#add");
    await page.waitForFunction(() => document.querySelectorAll("#rows li").length === 3);
    assert.deepEqual(await page.$$eval("#rows li", (lis) => lis.map((li) => li.textContent)), ["0:a", "1:b", "2:c"]);
    assert.equal(await page.textContent("#tone"), "child");
    assert.deepEqual(errors, []);
  });
});

test("resume: a child region re-creates parent slot content; scoped rows update; no component runs", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    await page.evaluate(() => ((window as unknown as TestWindow).__kept = true));
    assert.equal((await page.textContent("#title"))!.trim(), "Hello");
    assert.deepEqual(await page.$$eval("#rows li", (lis) => lis.map((li) => li.textContent)), ["0:a", "1:b"]);
    // Panel's conditional region renders the parent's slots (default function child + footer).
    await page.click("#toggle");
    await page.waitForFunction(() => document.querySelector("#foot"));
    assert.equal((await page.textContent("#n"))!.trim(), "1");
    await page.click("#inc");
    await page.waitForFunction(`${text("#n")} === "2"`);
    await page.waitForFunction(`${text("#foot")}.trim() === "2 items"`);
    await page.click("#toggle");
    await page.waitForFunction(() => !document.querySelector("#body"));
    await page.click("#toggle");
    await page.waitForFunction(`${text("#n")} === "2"`);
    // Rows' For re-creates rows through the parent's scoped slot.
    await page.click("#add");
    await page.waitForFunction(() => document.querySelectorAll("#rows li").length === 3);
    assert.deepEqual(await page.$$eval("#rows li", (lis) => lis.map((li) => li.textContent)), ["0:a", "1:b", "2:c"]);
    assert.equal(await page.evaluate(() => (globalThis as unknown as TestWindow).__componentRuns), undefined);
    assert.equal(await page.evaluate(() => (window as unknown as TestWindow).__kept), true);
    assert.deepEqual(errors, []);
  });
});
