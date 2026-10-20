// Resume: a spread-bound input / checkbox keeps the user's first, cold keystroke / toggle. The spread
// binding activates while the cold event replays; its first run must not write the stale server value
// over live form state (`value` / `checked` the user changed before activation).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = await readFile(new URL("./resume/spread-input-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/spread-input.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/spread-input.tsx").code);
const manifest: ResumeManifest = {
  hash: "spread-input",
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
// The handler chunk arrives after the keystroke's native default ran (the cold case).
const delays = { "/c/Page.js": 150 };

test("resume: the first, cold keystroke in a spread-bound input is kept", async () => {
  await withPage(
    files,
    async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/");
      await page.focus("#field");
      await page.keyboard.press("d");
      await page.waitForFunction(() => document.querySelector("#text")!.textContent === "d", undefined, { timeout: 3000 }).catch(() => {});
      assert.deepEqual(await page.evaluate(() => [document.querySelector<HTMLInputElement>("#field")!.value, document.querySelector("#text")!.textContent]), [
        "d",
        "d",
      ]);
      await page.keyboard.press("e");
      await page.waitForFunction(() => document.querySelector("#text")!.textContent === "de", undefined, { timeout: 3000 });
      assert.equal(await page.evaluate(() => document.querySelector<HTMLInputElement>("#field")!.value), "de");
      // Attributes the server rendered from the spread survive activation.
      assert.deepEqual(await page.evaluate(() => ["id", "type", "aria-label", "class"].map((name) => document.querySelector("#field")!.getAttribute(name))), [
        "field",
        "text",
        "name",
        "rv-Input",
      ]);
      assert.equal(await page.evaluate(() => (globalThis as { __componentRuns?: number }).__componentRuns), undefined);
      assert.deepEqual(errors, []);
    },
    { delays },
  );
});

test("resume: the first, cold Space on a spread-bound checkbox toggles it", async () => {
  await withPage(
    files,
    async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/");
      await page.focus("#box");
      await page.keyboard.press("Space");
      await page.waitForFunction(() => document.querySelector("#on")!.textContent === "true", undefined, { timeout: 3000 }).catch(() => {});
      assert.deepEqual(await page.evaluate(() => [document.querySelector<HTMLInputElement>("#box")!.checked, document.querySelector("#on")!.textContent]), [
        true,
        "true",
      ]);
      await page.keyboard.press("Space");
      await page.waitForFunction(() => document.querySelector("#on")!.textContent === "false", undefined, { timeout: 3000 });
      assert.equal(await page.evaluate(() => document.querySelector<HTMLInputElement>("#box")!.checked), false);
      assert.deepEqual(errors, []);
    },
    { delays },
  );
});

test("resume: a spread-bound value set by a handler still reaches the control", async () => {
  await withPage(files, async (page) => {
    await page.goto("http://rivet.test/");
    await page.focus("#field");
    await page.keyboard.type("abc");
    await page.waitForFunction(() => document.querySelector("#text")!.textContent === "abc", undefined, { timeout: 3000 });
    // Programmatic change through the signal path (select all, delete): the binding writes the new value.
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    await page.waitForFunction(() => document.querySelector("#text")!.textContent === "", undefined, { timeout: 3000 });
    assert.equal(await page.evaluate(() => document.querySelector<HTMLInputElement>("#field")!.value), "");
  });
});
