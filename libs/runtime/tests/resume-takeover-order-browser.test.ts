// Resume: bubbling order across a spread takeover (runtime-bugs K3-rt-1). An activated spread binds its handlers
// on the element; the loader's document capture walk used to run the still-delegated ancestors first, so an
// ancestor's preventDefault undid a checkbox toggle the descendant stopped (cdk Switch / Checkbox: Space after a
// label click; table select-all) and an ancestor ran before its descendant.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = await readFile(new URL("./resume/takeover-order-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/takeover-order.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/takeover-order.tsx").code);
const manifest: ResumeManifest = {
  hash: "takeover-order",
  runtime: "/rt.js",
  symbols: symbolUrls(dom.symbols),
};
const html = await resumableToString(() => server.Page(), { manifest });
const byComponent = symbolChunks(dom.symbols);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
};
Object.assign(files, symbolModules(byComponent));

const state = (page: import("playwright").Page) =>
  page.evaluate(() => [document.querySelector("#log")!.textContent, document.querySelector<HTMLInputElement>("#stopping")!.checked]);

test("resume: a taken-over element's stopPropagation keeps its delegated ancestors from running", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    // Before activation both are delegated: innermost first, stopped there.
    await page.click("#stopping");
    await page.waitForFunction(() => document.querySelector("#log")!.textContent === "inner");
    assert.deepEqual(await state(page), ["inner", true]);
    // Activate the spread (its binding reads `active`): the input now listens on itself.
    await page.click("#activate");
    await page.waitForFunction(() => document.querySelector("#stopping")!.getAttribute("data-active") === "1");
    await page.click("#stopping");
    await page.waitForFunction(() => document.querySelector("#log")!.textContent === "inner inner");
    await new Promise((resolve) => setTimeout(resolve, 100));
    // The label's handler (preventDefault) never ran: the native toggle stands.
    assert.deepEqual(await state(page), ["inner inner", false]);
    await page.focus("#stopping");
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.querySelector("#log")!.textContent === "inner inner inner");
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.deepEqual(await state(page), ["inner inner inner", true]);
    assert.equal(await page.evaluate(() => (globalThis as { __componentRuns?: number }).__componentRuns), undefined);
    assert.deepEqual(errors, []);
  });
});

test("resume: a delegated ancestor runs after a taken-over descendant (bubbling order)", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    await page.click("#activate");
    await page.waitForFunction(() => document.querySelector("#bubbling")!.getAttribute("data-active") === "1");
    await page.click("#bubbling");
    await page.waitForFunction(() => document.querySelector("#log")!.textContent!.split(" ").length >= 2);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(await page.evaluate(() => document.querySelector("#log")!.textContent), "inner2 outer2");
    // A later event of the same type sees no leftover deferred listener.
    await page.click("#outer2", { position: { x: 1, y: 1 } });
    await page.waitForFunction(() => document.querySelector("#log")!.textContent === "inner2 outer2 outer2");
    assert.deepEqual(errors, []);
  });
});
