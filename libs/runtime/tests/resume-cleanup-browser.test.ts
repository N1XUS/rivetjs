// Resume: a conditional child created in the browser (Show function child, ternary region) runs its
// onCleanup when its condition turns false (cdk DatePicker popover close).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = await readFile(new URL("./resume/cleanup-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/cleanup.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/cleanup.tsx").code);
const manifest: ResumeManifest = {
  hash: "cleanup",
  runtime: "/rt.js",
  symbols: symbolUrls(dom.symbols),
};
const html = await resumableToString(() => server.Page(), { manifest });
const byComponent = symbolChunks(dom.symbols);
const base: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
};
for (const [path, symbols] of Object.entries(byComponent)) base[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

test("resume: a conditional child created in the browser runs its onCleanup when its condition turns false", async () => {
  await withPage(base, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    await page.click("#toggle");
    await page.waitForFunction(() => document.querySelectorAll("#child").length === 4, undefined, { timeout: 3000 });
    await page.click("#toggle");
    await page.waitForFunction(() => document.querySelectorAll("#child").length === 0, undefined, { timeout: 3000 });
    await page.waitForTimeout(50);
    assert.equal(await page.textContent("#log"), "cccc");
    assert.deepEqual(errors, []);
  });
});
