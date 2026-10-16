// G26: SSR → resume → interact for functions that reach resumed captures through component props,
// behavior bags, spreads and conditional slot props (no serialization errors, handlers run once).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";
import { readable } from "./resume/wire.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = await readFile(new URL("./resume/captures-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/captures.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/captures.tsx").code);
const manifest: ResumeManifest = {
  hash: "captures",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const html = await resumableToString(() => server.Page(), { manifest });
const state = readable(JSON.parse(html.match(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/)![1]!));

test("server: captured props, bags and spreads serialize; spread handlers are recorded", () => {
  assert.match(html, /<p id="k5-out"><!--r\d+--><!--\/--><\/p>/);
  assert.match(html, /<button id="k2a"[^>]* data-r="\d+">s1<\/button>/);
  // The signal-reading spread records a binding whose name lists its spread handler.
  assert.ok(state.b.some((b: unknown[]) => typeof b[1] === "string" && /^\.\.\..* @click$/.test(b[1] as string)), JSON.stringify(state.b));
  assert.match(html, /id="g25a" class="h"/);
  assert.match(html, /id="g25b" class="h"/);
  assert.match(html, /id="g25c" class="n"/);
  assert.match(html, /<h2>A<\/h2>/);
  assert.doesNotMatch(html, /<h2>C<\/h2>/);
});

const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

test("resume: callbacks through props, bags and spreads run in the browser without re-rendering components", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    const fail = async (what: string) =>
      new Error(`${what}; page errors: ${errors.join(" | ")}; main: ${await page.evaluate(() => document.querySelector("main")!.outerHTML)}`);
    const text = (selector: string, value: string) =>
      page
        .waitForFunction(([s, v]) => document.querySelector(s!)?.textContent === v, [selector, value], { timeout: 5000 })
        .catch(async () => Promise.reject(await fail(`${selector} text ${value}`)));
    const attr = (selector: string, name: string, value: string) =>
      page
        .waitForFunction(([s, n, v]) => document.querySelector(s!)?.getAttribute(n!) === v, [selector, name, value], { timeout: 5000 })
        .catch(async () => Promise.reject(await fail(`${selector} ${name} ${value}`)));
    // K5: fragment-rooted const arrow.
    await page.click("#k5 .act");
    await text("#k5-out", "k5");
    await attr("#k5", "class", "menu open");
    // K1: inline callback props.
    await page.click("#k1a .act");
    await text("#k1-out", "k1a");
    await page.click("#k1b .act");
    await text("#k1-out", "k1b!");
    // K1: hook bag and inline object prop.
    await page.click("#k1c");
    await text("#k1-bag", "2");
    await page.click("#k1d");
    await text("#k1-bag", "12");
    await attr("#k1d", "data-presses", "1");
    // K2: spread handlers; the signal-reading spread re-binds its handler once activated, runs once per click.
    await page.click("#k2a");
    await text("#k2-out", "1:0");
    await page.click("#k2b");
    await text("#k2-out", "1:1");
    await attr("#k2b", "data-n", "1");
    await page.click("#k2b");
    await text("#k2-out", "1:2");
    await page.click("#k2b");
    await text("#k2-out", "1:3");
    await attr("#k2b", "data-n", "3");
    // G25: the class bindings re-read the serialized slot props.
    await page.click("#g25a");
    await attr("#g25a", "class", "h o");
    await page.click("#g25b");
    await attr("#g25b", "class", "h o");
    await page.click("#g25c");
    await attr("#g25c", "class", "n o");
    assert.equal(await page.evaluate(() => (globalThis as { __componentRuns?: number }).__componentRuns), undefined);
    assert.deepEqual(errors, []);
  });
});
