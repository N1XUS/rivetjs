// Resume: a revived signal whose value is falsy (0) keeps it across the re-creation of region 0. `arm` registers a
// region cleanup only for a `ref()` holding a server element; `held && refRegions.get(held)` handed the value `0` on as
// the region, so the first client navigation of a route-chunk build (which arms the layout's counter at idle) reset it
// (`Layout clicks ` → `NaN`, router transitions fixture, ROUTE-CHUNKS 2026-10-18).
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

const source = await readFile(new URL("./resume/falsy-signal-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/falsy-signal.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/falsy-signal.tsx").code);
const manifest: ResumeManifest = {
  hash: "falsy-signal",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const html = await resumableToString(() => server.Page(), { manifest });
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

test("resume: a signal at 0 survives the re-creation of region 0", async () => {
  // The case needs the counter's value to name an existing region: the panel's ternary is the page's first region.
  assert.ok(html.includes("<!--r0[-->"), "region 0 is the panel's ternary: " + html);
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    // Revive + arm `clicks` while it still holds 0 (read, not written).
    await page.click("#peek");
    await page.waitForFunction(() => document.querySelector("#seen")!.textContent === "0", undefined, { timeout: 3000 });
    // Region 0 is re-created: the counter's region cleanup (none, it is no ref) must not fire.
    await page.click("#toggle");
    await page.waitForFunction(() => document.querySelector("#state")!.textContent === "open", undefined, { timeout: 3000 });
    await page.click("#count");
    await page.waitForFunction(() => document.querySelector("#clicks")!.textContent === "1", undefined, { timeout: 3000 });
    assert.deepEqual(errors, []);
  });
});
