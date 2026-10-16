// Loader cold-key hints (`data-rk`): listed keys are held (preventDefault) while the handler chunk
// loads, so a cold arrow key / Space on a composite widget never scrolls the page; others are not.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
const source = await readFile(new URL("./resume/keys-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/keys.tsx");
const server = await importServer<{ Keys(): ServerValue }>(compileResume(source, "server", "src/keys.tsx").code);
const symbols: ResumeSymbol[] = dom.symbols;
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume();',
  "/c/Keys.js": rewrite(compileSymbolModule(symbols, "/fixture.mjs")),
};
const manifest: ResumeManifest = { hash: "test", runtime: "/rt.js", symbols: Object.fromEntries(symbols.map((s) => [s.id, "/c/Keys.js"])) };
files["/"] = "<!doctype html><html><head></head><body>" + (await resumableToString(() => server.Keys(), { manifest })) + "</body></html>";

test("cold keydown: data-rk keys are held while the chunk loads, then the handler runs", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Slow chunk: the default action would happen long before the handler could prevent it.
    await page.route("http://rivet.test/c/Keys.js", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fallback();
    });
    await page.goto("http://rivet.test/");
    await page.focus("#held");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.querySelector("#n")?.textContent === "2");
    assert.equal(await page.evaluate(() => scrollY), 0, "listed keys never scrolled");
    // Control: without data-rk the cold key's default action (scroll) happens.
    await page.goto("http://rivet.test/");
    await page.focus("#plain");
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(() => document.querySelector("#m")?.textContent === "1");
    assert.ok((await page.evaluate(() => scrollY)) > 0, "unlisted cold key scrolls");
    assert.deepEqual(errors, []);
  });
});

test("delegated listeners are not passive: a loaded mousedown handler can keep focus", async () => {
  await withPage(files, async (page) => {
    await page.goto("http://rivet.test/");
    await page.focus("#field");
    await page.click("#keep"); // cold: chunk loads, focus moves (cannot be held)
    await page.focus("#field");
    await page.waitForTimeout(300); // chunk and runtime in
    await page.click("#keep");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "field", "preventDefault on mousedown honoured");
  });
});
