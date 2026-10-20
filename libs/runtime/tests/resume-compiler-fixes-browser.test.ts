// Resumed pages for G19 compiler fixes: null-branch regions (E3), derived primitive consts (E6),
// ErrorBoundary with plain JSX children.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Name = "Hidden" | "Shown" | "Derived" | "Plain" | "ShowPlain";
const scope = globalThis as { __fail?: boolean };

const source = await readFile(new URL("./resume/compiler-fixes-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/g19.tsx");
const server = await importServer<Record<Name, () => ServerValue>>(compileResume(source, "server", "src/g19.tsx").code);
const byComponent = symbolChunks(dom.symbols);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume();',
};
Object.assign(files, symbolModules(byComponent));
const manifest: ResumeManifest = {
  hash: "test",
  runtime: "/rt.js",
  symbols: symbolUrls(dom.symbols),
};
const page = async (name: Name): Promise<string> =>
  "<!doctype html><html><head></head><body>" + (await resumableToString(() => server[name](), { manifest })) + "</body></html>";
for (const name of ["Hidden", "Shown", "Derived", "ShowPlain"] as const) files["/" + name.toLowerCase()] = await page(name);
scope.__fail = true;
files["/plain-failed"] = await page("Plain");
scope.__fail = false;
files["/plain"] = await page("Plain");

const visible = (page: import("playwright").Page) =>
  page.evaluate(() => [document.querySelector("#tern")!.innerHTML.replace(/<!--[^>]*-->/g, ""), document.querySelector("#and")!.innerHTML.replace(/<!--[^>]*-->/g, "")]);

test("a null/false SSR branch renders empty region markers and shows after its condition turns true", async () => {
  const html = files["/hidden"] as string;
  assert.match(html, /<p id="tern"><!--r\d+\[--><!--\]--><\/p>/);
  assert.match(html, /<p id="and"><!--r\d+\[--><!--\]--><\/p>/);
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/hidden");
    await page.click("#toggle");
    await page.waitForSelector("#yes");
    assert.deepEqual(await visible(page), ['<b id="yes">yes</b>', '<i id="and-i">and</i>']);
    await page.click("#toggle");
    await page.waitForFunction(() => !document.querySelector("#yes"));
    assert.deepEqual(await visible(page), ["", ""]);
    await page.click("#toggle");
    await page.waitForSelector("#yes");
    assert.deepEqual(await visible(page), ['<b id="yes">yes</b>', '<i id="and-i">and</i>']);
    assert.deepEqual(errors, []);
  });
});

test("a JSX SSR branch hides and shows again after resume", async () => {
  assert.match(files["/shown"] as string, /<p id="tern"><!--r\d+\[--><b id="yes">yes<\/b><!--\]--><\/p>/);
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/shown");
    await page.click("#toggle");
    await page.waitForFunction(() => !document.querySelector("#yes"));
    assert.deepEqual(await visible(page), ["", ""]);
    await page.click("#toggle");
    await page.waitForSelector("#yes");
    assert.deepEqual(await visible(page), ['<b id="yes">yes</b>', '<i id="and-i">and</i>']);
    assert.deepEqual(errors, []);
  });
});

test("consts derived through arrows may hold primitives (find(arrow) ?? fallback)", async () => {
  assert.match(files["/derived"] as string, /<output id="name"><!--r\d+-->one<!--\/--><\/output>/);
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/derived");
    await page.click("#next");
    await page.waitForFunction(() => document.querySelector("#name")!.textContent === "two");
    await page.click("#next");
    await page.waitForFunction(() => document.querySelector("#name")!.textContent === "fallback!");
    assert.deepEqual(errors, []);
  });
});

test("ErrorBoundary with plain JSX children: SSR fallback, reset re-renders the children in the browser", async () => {
  assert.match(files["/plain"] as string, /<b id="ok">ok<\/b><i id="sibling">sibling<\/i>/);
  assert.match(files["/plain-failed"] as string, /<button id="fb"[^>]*>flaky<\/button>/);
  assert.doesNotMatch(files["/plain-failed"] as string, /sibling/);
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/plain-failed");
    await page.click("#fb");
    await page.waitForSelector("#ok");
    assert.equal(await page.textContent("#sibling"), "sibling");
    assert.equal(await page.$("#fb"), null);
    assert.deepEqual(errors, []);
  });
});

test("Show with plain JSX children in a resume module toggles after resume", async () => {
  assert.match(files["/showplain"] as string, /<i id="off">off<\/i>/);
  assert.doesNotMatch(files["/showplain"] as string, /id="on"/);
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/showplain");
    await page.click("#toggle");
    await page.waitForSelector("#on");
    assert.equal(await page.$("#off"), null);
    await page.click("#toggle");
    await page.waitForSelector("#off");
    assert.equal(await page.$("#on"), null);
    assert.deepEqual(errors, []);
  });
});
