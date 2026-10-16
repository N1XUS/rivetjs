import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";

// A resumed `_spread`'s first run compared every key against a sentinel, so it rewrote `class` although the server's
// value was unchanged and dropped classes client code had added since (embla ClassNames `is-snapped`).
test("resume: a spread's first run leaves an unchanged server class alone (classes added by client code stay)", async () => {
  const source = await readFile(new URL("./resume/spread-class-fixture.tsx", import.meta.url), "utf8");
  const dom = compileResume(source, "dom");
  const server = await importServer<{ Page(): never }>(compileResume(source, "server").code);
  const chunks: Record<string, ResumeSymbol[]> = {};
  for (const symbol of dom.symbols) (chunks["/c/" + symbol.component + ".js"] ??= []).push(symbol);
  const files: Record<string, string> = {
    "/fixture.mjs": rewrite(dom.code),
    "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume();',
  };
  for (const [path, symbols] of Object.entries(chunks)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
  const manifest = { hash: "test", runtime: "/rt.js", symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])) };
  const body = await resumableToString(() => server.Page(), { manifest });
  assert.match(body, /<div id="keep" class="slide  embla__slide" data-kind="slide" data-n="1" data-r="\d+"><\/div>/);
  files["/"] = "<!doctype html><html><head></head><body>" + body + "</body></html>";
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto("http://rivet.test/");
    // A DOM plugin's init, before the first signal change.
    await page.evaluate(() => {
      for (const id of ["keep", "swap", "none"]) document.getElementById(id)!.classList.add("is-snapped");
    });
    const state = () =>
      page.evaluate(() =>
        ["keep", "swap", "none"].map((id) => document.getElementById(id)!.getAttribute("class") + "|" + document.getElementById(id)!.dataset.n),
      );
    await page.click("#inc");
    await page.waitForFunction(() => document.getElementById("keep")!.dataset.n === "2");
    assert.deepEqual(await state(), ["slide embla__slide is-snapped|2", "slide is-snapped|2", "is-snapped|2"]);
    // A changed class is written as on client renders (the spread owns the attribute).
    await page.click("#flip");
    await page.waitForFunction(() => document.getElementById("swap")!.classList.contains("on"));
    assert.deepEqual(await state(), ["slide embla__slide is-snapped|2", "slide on|2", "is-snapped|2"]);
    assert.equal(await page.evaluate(() => (globalThis as { __componentRuns?: number }).__componentRuns ?? 0), 0);
    assert.deepEqual(errors, []);
  });
});
