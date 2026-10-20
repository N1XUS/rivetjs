// SSR-OMITTED-SLOTS (review LOW-1) in Chromium: inert `omitted()` slots (a `prop:` element effect, a
// `window:` client event) are null on the server now. The element they sit on still resumes: its
// `_rFn` handlers fire, an absent conditional handler stays absent and its `ref()` holds the element.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";
import type { Page } from "playwright";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
interface Fixture {
  Omitted(props: { armed?: boolean }): ServerValue;
}

const source = await readFile(new URL("./resume/omitted-fixture.tsx", import.meta.url), "utf8");
const serverCode = compileResume(source, "server", "src/omitted.tsx").code;
const dom = compileResume(source, "dom", "src/omitted.tsx");
const server = await importServer<Fixture>(serverCode);
const byComponent = symbolChunks(dom.symbols);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume();',
};
Object.assign(files, symbolModules(byComponent));
const manifest: ResumeManifest = {
  hash: "omitted",
  runtime: "/rt.js",
  symbols: symbolUrls(dom.symbols),
};
const html = await resumableToString(() => server.Omitted({ armed: true }), { manifest });
files["/omitted"] = "<!doctype html><html><head></head><body>" + html + "</body></html>";

const errorsOf = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  return errors;
};
const text = (page: Page, selector: string, value: string) =>
  page.waitForFunction(([s, v]) => document.querySelector(s!)?.textContent === v, [selector, value], { timeout: 5000 });

test("the fixture renders its element effect and client event through null omitted slots", () => {
  // Pin the lowering this test depends on: both are `omitted(…)` slots, which are null (inert) now.
  assert.match(serverCode, /__rivetOmitted\(__rivetR_effect\(/);
  assert.match(serverCode, /__rivetOmitted\(__rivetR_clientEvent\(/);
  assert.match(html, /<button id="b" data-r="\d+"[^>]*><!--r\d*-->0<!--\/--><\/button>/);
});

test("a resumed element next to null omitted slots: `_rFn` handlers fire, the ref holds the element, effect + client event run", async () => {
  await withPage(files, async (page) => {
    const errors = errorsOf(page);
    await page.goto("http://rivet.test/omitted");
    // `prop:title` element effect (`when: "load"`): set in the browser after load.
    await page.waitForFunction(() => (document.getElementById("b") as HTMLButtonElement).title === "n0", undefined, { timeout: 5000 });
    // A real click: `onPointerDown={boost}` (a conditional `_rFn` handler present at render) adds 10,
    // then the inline click handler adds 1 and writes through the `ref()` (element captured by id).
    await page.click("#b");
    await text(page, "#b", "11");
    assert.equal(await page.evaluate(() => document.getElementById("b")!.dataset.clicks), "11");
    await page.waitForFunction(() => (document.getElementById("b") as HTMLButtonElement).title === "n11", undefined, { timeout: 5000 });
    await page.dispatchEvent("#b", "pointerdown", { bubbles: true });
    await text(page, "#b", "21");
    // `onKeyDown={never}`: absent at render, stays absent.
    await page.dispatchEvent("#b", "keydown", { bubbles: true, key: "a" });
    await page.waitForTimeout(50);
    assert.equal(await page.textContent("#b"), "21");
    // `window:onResize`: client event recorded through its null slot.
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await text(page, "#resized", "1");
    assert.deepEqual(errors, []);
  });
});
