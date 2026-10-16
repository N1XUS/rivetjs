// Resumed bindings that read a signal provided as an identified context arm on resume (regression: T7 fix 4's
// rolled-back-signal check in `arm` skipped context signals, which the decoder never holds, so router root-layout
// bindings such as useSearchParams() stopped following navigations).
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

const source = await readFile(new URL("./resume/context-signal-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/context-signal.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/context-signal.tsx").code);
const manifest: ResumeManifest = {
  hash: "context-signal",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const html = await resumableToString(() => server.Page(), { manifest });
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js":
    'import { createResume } from "/dom-resume.ts"; import { signal } from "/reactivity.mjs"; import { Live } from "/fixture.mjs";' +
    ' export default createResume({ contexts: [[Live, signal("client")]] });',
  "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

test("server: the provided signal ships as a context reference", () => {
  assert.match(html, /<b id="v"><!--r0-->server<!--\/--><\/b>/);
  assert.match(html, /"x":"ctx-live"/);
});

test("resumed: a binding reading an identified context's signal follows its first change", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    await page.click("#set");
    await page.waitForFunction(() => document.querySelector("#v")!.textContent === "clicked", undefined, { timeout: 5000 });
    assert.deepEqual(errors, []);
  });
});
