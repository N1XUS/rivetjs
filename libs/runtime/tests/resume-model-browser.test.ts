// model: read on the server is untracked: typing into a resumed model:value / model:checked inside a
// component region updates the signal without re-creating the component (focus and state survive).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
const source = await readFile(new URL("./resume/model-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/model.tsx");
const server = await importServer<{ Models(): ServerValue }>(compileResume(source, "server", "src/model.tsx").code);
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume();',
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
const manifest: ResumeManifest = {
  hash: "test",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const html = await resumableToString(() => server.Models(), { manifest });
files["/models"] = "<!doctype html><html><head></head><body>" + html + "</body></html>";

test("SSR: model: values render, and the component is not a region over the model signals", () => {
  assert.match(html, /<input id="text" value="hi" data-r="\d+">/);
  assert.match(html, /<input id="agree" type="checkbox" data-r="\d+">/);
  // The component call reads nothing reactive itself: no region wraps <div> (only text bindings inside).
  assert.doesNotMatch(html, /<!--r\d+\[--><div>/);
});

test("resume: typing into model:value keeps the element, focus and component state; both directions sync", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/models");
    await page.click("#inc");
    await page.waitForFunction(() => document.querySelector("#inc")!.textContent === "1");
    await page.evaluate(() => ((document.querySelector("#text") as HTMLInputElement & { tag?: number }).tag = 1));
    await page.focus("#text");
    await page.keyboard.press("End");
    await page.keyboard.type("!?");
    await page.waitForFunction(() => document.querySelector("#out")!.textContent === "hi!?");
    const state = await page.evaluate(() => {
      const input = document.querySelector("#text") as HTMLInputElement & { tag?: number };
      return [input.tag, document.activeElement === input, input.value, document.querySelector("#inc")!.textContent];
    });
    assert.deepEqual(state, [1, true, "hi!?", "1"]);
    // model:checked: same element, state kept.
    await page.click("#agree");
    await page.waitForFunction(() => document.querySelector("#agreed")!.textContent === "yes");
    assert.equal(await page.textContent("#inc"), "1");
    assert.equal(await page.evaluate(() => (document.querySelector("#text") as HTMLInputElement & { tag?: number }).tag), 1);
    // Signal → element.
    await page.click("#reset");
    await page.waitForFunction(() => (document.querySelector("#text") as HTMLInputElement).value === "reset");
    assert.equal(await page.evaluate(() => (document.querySelector("#agree") as HTMLInputElement).checked), false);
    assert.equal(await page.textContent("#out"), "reset");
    assert.equal(await page.textContent("#inc"), "1");
    // Element → signal after the signal wrote it.
    await page.fill("#text", "again");
    await page.waitForFunction(() => document.querySelector("#out")!.textContent === "again");
    assert.equal(await page.evaluate(() => (document.querySelector("#text") as HTMLInputElement & { tag?: number }).tag), 1);
    assert.deepEqual(errors, []);
  });
});
