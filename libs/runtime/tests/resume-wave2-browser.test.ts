// Wave-2 compiler resume fixes in the browser: member-read / projection captures of spread and
// styled sites, conditional handler presence, explicit capture-phase handlers, self-referencing
// const arrows (scratchpad specs resume-bugs.md §4/§5/§6/§7, dom-v2-spread.md §3).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";
import type { Page } from "playwright";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
interface Fixture {
  Members(): ServerValue;
  Presence(): ServerValue;
  CaptureRec(): ServerValue;
  Adopt(): ServerValue;
}

const source = await readFile(new URL("./resume/wave2-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/wave2.tsx");
const server = await importServer<Fixture>(compileResume(source, "server", "src/wave2.tsx").code);
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const serve = (code: string): string => rewrite(code).replaceAll("@rivetjs/cdk/dom-props", "/dom-props.ts");
const files: Record<string, Served> = {
  "/fixture.mjs": serve(dom.code),
  // `serve`: the helper imports `@rivetjs/runtime/props` (live props `splitProps`).
  "/dom-props.ts": serve(stripTypeScriptTypes(await readFile(new URL("../../cdk/utils/dom-props.ts", import.meta.url), "utf8"))),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume();',
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = serve(compileSymbolModule(symbols, "/fixture.mjs"));
const manifest: ResumeManifest = {
  hash: "wave2",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const pages: Record<string, { html: string; state: { t: unknown[]; e: Record<string, Record<string, unknown>> } }> = {};
for (const component of ["Members", "Presence", "CaptureRec", "Adopt"] as const) {
  const html = await resumableToString(() => server[component](), { manifest });
  const path = "/" + component.toLowerCase();
  files[path] = "<!doctype html><html><head></head><body>" + html + "</body></html>";
  pages[path] = { html, state: JSON.parse(html.match(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/)![1]!) };
}
const errorsOf = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  return errors;
};
const text = (page: Page, selector: string, value: string) =>
  page.waitForFunction(([s, v]) => document.querySelector(s!)?.textContent === v, [selector, value], { timeout: 5000 });

test("compiled: spread / style sites capture members and projections; the state holds no unused prop", () => {
  const row = dom.symbols.filter((s) => s.component === "Row");
  assert.deepEqual(
    row.map((s) => [s.kind, s.captures]),
    // The plain `style` merges into the spread object (compile.rs, user ruling 2026-10-06): one site.
    [["spread", ["props$0", "props$title", "props$n"]]],
  );
  const { html, state } = pages["/members"]!;
  assert.doesNotMatch(JSON.stringify(state), /ZZZSECRET|kid/);
  assert.match(html, /<p lang="fi" id="row" title="t1" data-n="1" style="--n:1" data-r="\d+"><b id="kid">k<\/b><\/p>/);
});

test("resumed spread / style bindings with member captures update on change; the eager child stays", async () => {
  await withPage(files, async (page) => {
    const errors = errorsOf(page);
    await page.goto("http://rivet.test/members");
    await page.click("#inc");
    await page.waitForFunction(() => document.querySelector("#row")?.getAttribute("title") === "t2", undefined, { timeout: 5000 });
    assert.equal(await page.getAttribute("#row", "data-n"), "2");
    assert.equal(await page.$eval("#row", (el) => (el as HTMLElement).style.getPropertyValue("--n")), "2");
    assert.equal(await page.textContent("#kid"), "k");
    assert.deepEqual(errors, []);
  });
});

test("presence: an absent conditional handler records nothing; the present one resumes", async () => {
  const { html, state } = pages["/presence"]!;
  assert.doesNotMatch(html, /data-events="[^"]*\breset\b/);
  assert.match(html, /data-events="[^"]*\bsubmit\b/);
  assert.ok(!Object.values(state.e).some((entry) => "reset" in entry), JSON.stringify(state.e));
  await withPage(files, async (page) => {
    const errors = errorsOf(page);
    await page.goto("http://rivet.test/presence");
    await page.click("#s");
    await text(page, "#log", "submit,");
    await page.click("#n");
    await text(page, "#o", "1");
    assert.deepEqual(errors, []);
  });
});

test("an explicit `onClickCapture` resumes (capture first); a self-referencing const arrow re-creates", async () => {
  const { state } = pages["/capturerec"]!;
  assert.ok(
    Object.values(state.e).some((entry) => "click!" in entry),
    JSON.stringify(state.e),
  );
  const fact = dom.symbols.find((s) => s.kind === "fn" && s.component === "CaptureRec")!;
  assert.deepEqual(fact.captures, []);
  await withPage(files, async (page) => {
    const errors = errorsOf(page);
    await page.goto("http://rivet.test/capturerec");
    assert.equal(await page.textContent("#fact"), "6");
    await page.click("#inner");
    await text(page, "#log", "cap,bubble,");
    await text(page, "#fact", "24");
    assert.deepEqual(errors, []);
  });
});

test("a `<For>` among a component's lazy children is its own region: a reorder adopts the rows", async () => {
  const { html } = pages["/adopt"]!;
  // The list's markers sit inside <ul>, not around the whole <List>.
  assert.match(html, /<ul id="list"><!--r\d+\[--><!--r\d+\[--><li class="row">a<\/li>/);
  await withPage(files, async (page) => {
    const errors = errorsOf(page);
    await page.goto("http://rivet.test/adopt");
    await page.evaluate(() => {
      for (const el of document.querySelectorAll<HTMLElement>("#list > .row")) (el as unknown as { tag: string }).tag = el.textContent!;
    });
    await page.click("#rev");
    await page.waitForFunction(() => document.querySelector("#list > .row")?.textContent === "c", undefined, { timeout: 5000 });
    const rows = await page.$$eval("#list > .row", (els) => els.map((el) => [el.textContent, (el as unknown as { tag?: string }).tag]));
    assert.deepEqual(rows, [
      ["c", "c"],
      ["b", "b"],
      ["a", "a"],
    ]);
    assert.deepEqual(errors, []);
  });
});
