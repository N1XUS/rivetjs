// Function Bridge T27 review L2: `reconstruct(() => …)` on resumed pages — the factory has not run before the first
// read, re-runs with onCleanup after a captured signal changes, works per For row and reads its providers' contexts.
// Fixture `resume/reconstruct-fixture.tsx`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";
import type { Page } from "playwright";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = await readFile(new URL("./resume/reconstruct-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/rc.tsx");
const server = await importServer<Record<string, () => ServerValue> & { log: string[] }>(compileResume(source, "server", "src/rc.tsx").code);
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const manifest: ResumeManifest = {
  hash: "rc",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const base: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
for (const [path, symbols] of Object.entries(byComponent)) base[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

const out = (page: Page) => page.evaluate(() => document.querySelector(".out")!.textContent);
const log = (page: Page) => page.evaluate(async () => [...((await import("/fixture.mjs" as string)) as { log: string[] }).log]);
async function clickUntil(page: Page, selector: string, text: string): Promise<void> {
  await page.click(selector);
  await page.waitForFunction((t) => document.querySelector(".out")!.textContent === t, text, { timeout: 3000 });
}

/** Render `name` resumably and run `body` on the loaded page; page errors fail the test. */
async function onPage(name: string, body: (page: Page) => Promise<void>): Promise<void> {
  const html = await resumableToString(() => server[name]!(), { manifest });
  const files = { ...base, "/": "<!doctype html><html><head></head><body>" + html + "</body></html>" };
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto("http://rivet.test/");
    await body(page);
    if (await page.evaluate(() => (globalThis as { __componentRuns?: unknown }).__componentRuns)) errors.push("a component ran in the browser");
    assert.deepEqual(errors, []);
  });
}

test("the server render does not run a factory it never reads", () => {
  assert.deepEqual(server.log, []);
});

test("resumed: the factory has not run before the first read; a captured signal change re-runs it with onCleanup", async () => {
  await onPage("Lazy", async (page) => {
    assert.deepEqual(await log(page), []);
    await clickUntil(page, ".go", "a");
    assert.deepEqual(await log(page), ["run:a"]);
    await clickUntil(page, ".go", "a").catch(() => {});
    assert.deepEqual(await log(page), ["run:a"], "a second read reuses the value");
    await page.click(".next");
    await clickUntil(page, ".go", "a+");
    assert.deepEqual(await log(page), ["run:a", "clean:a", "run:a+"]);
  });
});

test("resumed: a reconstruct inside a For row runs per row, on that row's first read", async () => {
  await onPage("Rows", async (page) => {
    assert.equal(await out(page), "");
    await clickUntil(page, ".go.y", "<y>");
    await clickUntil(page, ".go.x", "<y><x>");
    await clickUntil(page, ".go.y", "<y><x><y>");
    assert.deepEqual(await log(page), ["row:y", "row:x"]);
  });
});

test("resumed: the factory reads the context provided around its component on the server", async () => {
  await onPage("Context", async (page) => {
    await clickUntil(page, ".go", "dark");
    assert.deepEqual(await log(page), ["theme"]);
  });
});
