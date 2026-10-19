// Resume: a ref() whose element sits inside a region, first decoded by that region's re-creation (lane ARM-FIX). The
// re-creation disposed the region's owner, then decoded its state; `arm` registered the ref's reset on that disposed
// owner and threw "Cannot run with a disposed owner" (the re-creation aborted, the server element stayed with its
// server handlers). Fixed: a ref decoded for a dead region resets at once; the re-created element takes it.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { Page } from "playwright";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = await readFile(new URL("./resume/ref-recreate-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/ref-recreate.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/ref-recreate.tsx").code);
const manifest: ResumeManifest = {
  hash: "ref-recreate",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const html = await resumableToString(() => server.Page(), { manifest });
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

async function recreate(id: string, key: string): Promise<void> {
  await withPage(files, async (page: Page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto("http://rivet.test/");
    assert.equal(await page.textContent("#" + id), "zero");
    // Mark the server element: the re-created one carries no mark.
    await page.evaluate((id) => ((document.getElementById(id) as HTMLElement & { __server?: true }).__server = true), id);
    await page.click("#" + id);
    await page
      .waitForFunction((id) => document.getElementById(id)?.textContent === "more", id, { timeout: 5000 })
      .catch(async () => Promise.reject(new Error("not re-created; errors: " + errors.join(" | ") + "; " + (await page.content()))));
    assert.equal(await page.evaluate((id) => !!(document.getElementById(id) as HTMLElement & { __server?: true }).__server, id), false, "re-created element");
    // The ref holds the re-created element (not the detached server one, not undefined).
    await page.click("#" + id + "-probe");
    await page.waitForFunction((key) => (globalThis as unknown as Record<string, string>)["__" + key] !== undefined, key, { timeout: 5000 });
    assert.equal(await page.evaluate((key) => (globalThis as unknown as Record<string, string>)["__" + key], key), "new");
    // Still live: the re-created element's handler runs.
    await page.click("#" + id);
    assert.equal(await page.textContent("#" + id), "more");
    assert.deepEqual(errors, []);
  });
}

test("server: both refs are captured as element ids inside the re-created region", () => {
  assert.match(html, /<button id="local" type="button" data-r="\d+"><span data-r="\d+">zero<\/span><\/button>/);
  assert.match(html, /<button id="provided" type="button" data-r="\d+"><span data-r="\d+">zero<\/span><\/button>/);
});

test("resume: a `_regionState` ref() first decoded by its region's re-creation takes the re-created element", async () => {
  await recreate("local", "local");
});

test("resume: a provided ref() (FocusableContext shape) first decoded by the re-creation takes the re-created element", async () => {
  await recreate("provided", "provided");
});
