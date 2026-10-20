// Resume runtime bug fixes (wave 2): function recipes keep their creation site (no cyclic entries),
// region chunk lists cover `_regionState` locals, text bindings upgrade to child ranges.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { createDecoder } from "@rivetjs/runtime/resume-format";
import { signal } from "@rivetjs/reactivity";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";
import { readable } from "./resume/wire.ts";
import type { Page } from "playwright";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
interface Fixture {
  Defaults(): ServerValue;
  Locals(): ServerValue;
  TextUpgrade(): ServerValue;
  ColdKeys(): ServerValue;
  Capture(): ServerValue;
  Providers(): ServerValue;
  Tokens(): ServerValue;
}

const source = await readFile(new URL("./resume/bugs-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/bugs.tsx");
const server = await importServer<Fixture>(compileResume(source, "server", "src/bugs.tsx").code);
const byComponent = symbolChunks(dom.symbols);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume();',
};
Object.assign(files, symbolModules(byComponent));
const manifest: ResumeManifest = {
  hash: "bugs",
  runtime: "/rt.js",
  symbols: symbolUrls(dom.symbols),
};
const pages: Record<
  string,
  { html: string; state: { t: unknown[]; s: Record<string, number>; b: unknown[][]; c: string[]; e: Record<string, Record<string, unknown>> } }
> = {};
for (const component of ["Defaults", "Locals", "TextUpgrade", "ColdKeys", "Capture", "Providers", "Tokens"] as const) {
  const html = await resumableToString(() => server[component](), { manifest });
  const path = "/" + component.toLowerCase();
  files[path] = "<!doctype html><html><head></head><body>" + html + "</body></html>";
  pages[path] = { html, state: readable(JSON.parse(html.match(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/)![1]!)) };
}

const errorsOf = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  return errors;
};
const text = (page: Page, selector: string, value: string) =>
  page.waitForFunction(([s, v]) => document.querySelector(s!)?.textContent === v, [selector, value], { timeout: 5000 });

test("bug 1/2: a function passed through `props.fn ?? default` keeps its creation recipe (no cyclic entry)", () => {
  const { t, s } = pages["/defaults"]!.state;
  // Every function entry decodes without a cycle (the decoder throws on one).
  const decoder = createDecoder(t as never, { signal: () => signal(0) as never, computed: () => () => 0, fn: () => () => 0 });
  t.forEach((entry, ref) => {
    if (entry && typeof entry === "object" && "f" in (entry as object)) decoder.get(ref);
  });
  // The field's `shown` const resolves to the page's inline arrow: no entry is registered under the field's own symbol.
  const fieldFn = (t as { f?: string }[]).find((entry) => entry?.f?.includes("#Field$"));
  assert.equal(fieldFn, undefined, JSON.stringify(t));
  assert.ok(Object.keys(s).some((id) => id.includes("#Defaults$")));
});

test("bug 1/2: field error shows and the arrow-backed list filters after resume", async () => {
  await withPage(files, async (page) => {
    const errors = errorsOf(page);
    await page.goto("http://rivet.test/defaults");
    assert.equal(await page.getAttribute("#err", "hidden"), "");
    await page.click("#go");
    await page.waitForFunction(() => !document.querySelector("#err")!.hasAttribute("hidden"), undefined, { timeout: 5000 });
    assert.equal(await page.textContent("#err"), "required");
    await page.click("#b");
    await text(page, "#count", "2");
    await page.waitForFunction(() => document.querySelectorAll("#list li").length === 2, undefined, { timeout: 5000 });
    assert.deepEqual(await page.$$eval("#list li", (items) => items.map((item) => item.textContent)), ["banana", "blueberry"]);
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => (window as { __componentRuns?: unknown }).__componentRuns), undefined);
  });
});

test("bug 9a: region entries list the chunks of their `_regionState` locals", () => {
  const { s, b, c } = pages["/locals"]!.state;
  // The arrow's own symbol (the site symbol around it also contains its text: take the shortest).
  const arrow = dom.symbols.filter((symbol) => symbol.source.includes('"changed:"')).sort((a, b) => a.source.length - b.source.length)[0]!.id;
  assert.ok(arrow in s, "the page's inline arrow symbol is in state.s: " + JSON.stringify(s));
  // The Standalone region (symbol of the page's site) carries locals; its chunk list includes the page chunk.
  const region = b.find((entry) => entry[1] === "#" && entry[11]) as [number, string, string, number[], number[], number[], ...unknown[]] | undefined;
  assert.ok(region, JSON.stringify(b));
  assert.ok(
    region[5].some((i) => c[i] === "/c/Locals.js"),
    JSON.stringify(region),
  );
});

test("bug 9a: a standalone region adopting state that holds the page's arrow re-creates and calls it", async () => {
  await withPage(files, async (page) => {
    const errors = errorsOf(page);
    await page.goto("http://rivet.test/locals");
    await page.click("#toggle");
    await text(page, "#st", "open");
    await page.click("#close");
    await text(page, "#log", "changed:false");
    assert.deepEqual(errors, []);
  });
});

test("bug 10: a resumed text binding upgrades to a child range when its value becomes an element", async () => {
  assert.match(pages["/textupgrade"]!.html, /<p id="p"><!--r\d+-->plain<!--\/--><\/p>/);
  await withPage(files, async (page) => {
    const errors = errorsOf(page);
    await page.goto("http://rivet.test/textupgrade");
    await page.click("#tu");
    await page.waitForFunction(() => document.querySelector("#p b")?.textContent === "bold", undefined, { timeout: 5000 });
    await page.click("#tu");
    await text(page, "#p", "plain");
    assert.equal(await page.$("#p b"), null);
    await page.click("#tu");
    await page.waitForFunction(() => document.querySelector("#p b")?.textContent === "bold", undefined, { timeout: 5000 });
    assert.deepEqual(errors, []);
  });
});

test("bug 3: a cold keydown survives the spread binding taking its handler over while chunks load", async () => {
  // The keyboard bag's chunk evaluates late (top-level await); the input handler's chunk is immediate.
  const slow = { ...files, "/c/useKeys.js": "await new Promise((r) => setTimeout(r, 400));\n" + (files["/c/useKeys.js"] as string) };
  await withPage(slow, async (page) => {
    const errors = errorsOf(page);
    await page.goto("http://rivet.test/coldkeys");
    await page.focus("#ck");
    await page.keyboard.press("a");
    await text(page, "#text", "a");
    await text(page, "#keys", "a");
    await page.keyboard.press("b");
    await text(page, "#text", "ab");
    await text(page, "#keys", "ab");
    assert.deepEqual(errors, []);
  });
});

test("bug 6: capture-phase spread handlers resume (order, stopPropagation, non-bubbling focus)", async () => {
  const { html, state } = pages["/capture"]!;
  assert.match(html, /data-events="[^"]*\bfocus\b/);
  assert.ok(
    Object.values(state.e).some((entry) => "click!" in entry),
    JSON.stringify(state.e),
  );
  await withPage(files, async (page) => {
    const errors = errorsOf(page);
    await page.goto("http://rivet.test/capture");
    await page.click("#inner");
    await text(page, "#log", "cap,bubble,");
    await page.click("#inner");
    await text(page, "#log", "cap,bubble,cap,bubble,");
    await page.click("#stop");
    await text(page, "#log", "cap,bubble,cap,bubble,stopcap,");
    await page.focus("#f");
    await text(page, "#log", "cap,bubble,cap,bubble,stopcap,fcap,");
    assert.deepEqual(errors, []);
  });
});

test("registered context tokens held as values resume as the tokens themselves (clearContexts)", async () => {
  const { state } = pages["/tokens"]!;
  // By id (`{k: "ctx"}`), never a plain `{defaultValue, id}` copy.
  const kinds = state.t.filter((entry) => (entry as { k?: string })?.k === "ctx");
  assert.equal(kinds.length, 2, JSON.stringify(state.t));
  assert.ok(!JSON.stringify(state.t).includes("defaultValue"), JSON.stringify(state.t));
  await withPage(files, async (page) => {
    const errors = errorsOf(page);
    await page.goto("http://rivet.test/tokens");
    await page.click("#t1");
    await text(page, "#t1", "true/cleared");
    await page.click("#t2");
    await text(page, "#t2", "true/cleared");
    assert.deepEqual(errors, []);
  });
});

test("bug 9c: a region inside an identified provider outside any region re-creates inside it", async () => {
  const { state } = pages["/providers"]!;
  const region = state.b.find((entry) => entry[1] === "#") as unknown[] | undefined;
  assert.ok(region && Array.isArray(region[12]) && region[12][0] === "theme", JSON.stringify(state.b));
  const providers = region[12] as (string | number)[];
  // A registered token's object value is in the table structurally, never as a `{x}` context reference.
  const locale = state.t[providers[providers.indexOf("locale") + 1] as number];
  assert.deepEqual(locale, { j: { locale: "de-DE" } }, JSON.stringify(state.t));
  assert.ok(!state.t.some((entry) => (entry as { x?: string })?.x === "locale"), JSON.stringify(state.t));
  assert.ok(providers.includes("server-only"), JSON.stringify(providers));
  // Two regions under the same providers: the wire holds the list once (a table array), both [12] its index.
  const wire = JSON.parse(pages["/providers"]!.html.match(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/)![1]!) as { b: unknown[][]; t: unknown[] };
  const lists = wire.b.filter((entry) => entry[1] === "#").map((entry) => entry[12]);
  assert.equal(lists.length, 2);
  assert.equal(typeof lists[0], "number");
  assert.equal(lists[0], lists[1]);
  assert.ok(Array.isArray(wire.t[lists[0] as number]));
  assert.deepEqual(state.b.filter((entry) => entry[1] === "#")[1]![12], providers);
  await withPage(files, async (page) => {
    const errors = errorsOf(page);
    await page.goto("http://rivet.test/providers");
    assert.equal(await page.textContent("#themed"), "dark/de-DE:0");
    assert.equal(await page.textContent("#themed2"), "dark/de-DE:0");
    await page.click("#inc");
    // "server-only" is unknown to the client (no loaded module registers it): skipped, not thrown.
    await text(page, "#themed", "dark/de-DE:1");
    await text(page, "#themed2", "dark/de-DE:1");
    assert.deepEqual(errors, []);
  });
});
