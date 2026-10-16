// G-RES: rows of a For whose site is no region (static `each`) resume without row markers through one
// `*` row-template entry (compact rows + template, expanded by the loader like a region's rows).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";
import type { Page } from "playwright";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
interface Fixture {
  StaticList(): ServerValue;
  TwoLists(): ServerValue;
}

const source = await readFile(new URL("./resume/static-list-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/static-list.tsx");
const server = await importServer<Fixture>(compileResume(source, "server", "src/static-list.tsx").code);
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume();',
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
const manifest: ResumeManifest = {
  hash: "static-list",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const html: Record<string, string> = {};
for (const component of ["StaticList", "TwoLists"] as const) {
  html[component] = await resumableToString(() => server[component](), { manifest });
  files["/" + component.toLowerCase()] = "<!doctype html><html><head></head><body>" + html[component] + "</body></html>";
}
type Entry = [number, string | null, string, number[], number[], number[], number, unknown?, unknown?, unknown?];
const stateOf = (page: string): { b: Entry[]; e: Record<string, unknown> } =>
  JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(page)![1]!.replace(/\\u003c/g, "<"));

const errorsOf = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  return errors;
};
const attr = (page: Page, selector: string, name: string, value: string) =>
  page.waitForFunction(([s, n, v]) => document.querySelector(s!)?.getAttribute(n!) === v, [selector, name, value], { timeout: 5000 });
const text = (page: Page, selector: string, value: string) =>
  page.waitForFunction(([s, v]) => document.querySelector(s!)?.textContent === v, [selector, value], { timeout: 5000 });

test("static For rows: no row markers, one `*` template entry (compact rows), no per-row entries", () => {
  const page = html.StaticList!;
  assert.equal((page.match(/<!--r\d+\[-->/g) ?? []).length, 0, "no region / row markers");
  const state = stateOf(page);
  const lists = state.b.filter((entry) => entry[1] === "*");
  assert.equal(lists.length, 1);
  const [, , , , , , , , rows, template] = lists[0]!;
  assert.deepEqual(Object.keys(rows as object).sort(), ["d", "i", "r"]);
  assert.equal((rows as { r: number[] }).r.length, 3);
  assert.ok((template as { e: object }).e, "row template carries the handler");
  assert.deepEqual(state.e, {}, "no explicit per-row handler entries");
  assert.equal(state.b.filter((entry) => entry[1] === "data-state").length, 0, "no explicit per-row bindings");
});

test("static For rows resume: handler + reactive attribute per row update after resume", async () => {
  await withPage(files, async (page) => {
    const errors = errorsOf(page);
    await page.goto("http://rivet.test/staticlist");
    await page.click("#list li:nth-child(2) button");
    await text(page, "#out", "2");
    await attr(page, "#list li:nth-child(2)", "data-state", "on");
    await page.click("#list li:nth-child(3) button");
    await attr(page, "#list li:nth-child(3)", "data-state", "on");
    await attr(page, "#list li:nth-child(2)", "data-state", "off");
    await text(page, "#out", "3");
    assert.deepEqual(errors, []);
  });
});

test("static site with two lists of different shapes: explicit entries, no markers, both resume", async () => {
  const page = html.TwoLists!;
  assert.equal((page.match(/<!--r\d+\[-->/g) ?? []).length, 0);
  await withPage(files, async (page) => {
    const errors = errorsOf(page);
    await page.goto("http://rivet.test/twolists");
    await page.click("button.a >> nth=1");
    await text(page, "#picked", "y");
    await page.click("i.b");
    await text(page, "#picked", "z!");
    await attr(page, "i.b", "title", "z!");
    assert.deepEqual(errors, []);
  });
});
