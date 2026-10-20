// TERNARY-MEMO (compiler `cond_v2` + runtime `_cond`): a conditional child with a JSX operand is rebuilt only when
// its rendered branch changes — a read inside the test that keeps the branch keeps the branch's nodes (a CSS enter
// animation would replay on a rebuilt node). Client-only mount and a resumed server-rendered page (fixture
// `resume/cond-memo-fixture.tsx`); identity checked with expando marks, compared as booleans (cheap asserts).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compile } from "@rivetjs/compiler";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";
import type { Page } from "playwright";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = await readFile(new URL("./resume/cond-memo-fixture.tsx", import.meta.url), "utf8");
const csr = compile(source, { target: "dom", filename: "cond-memo-fixture.tsx" });
assert.deepEqual(csr.diagnostics, []);
const dom = compileResume(source, "dom", "src/cond-memo.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/cond-memo.tsx").code);
const byComponent = symbolChunks(dom.symbols);
const manifest: ResumeManifest = {
  hash: "cond-memo",
  runtime: "/rt.js",
  symbols: symbolUrls(dom.symbols),
};
const ssr = await resumableToString(() => server.Page(), { manifest });
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/csr.mjs": rewrite(csr.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/csr": `<!doctype html><html><body><div id="app"></div><script type="module">
    import { mount } from "/dom.ts"; import { Page } from "/csr.mjs";
    mount(() => Page(), document.getElementById("app"));
  </script></body></html>`,
  "/": "<!doctype html><html><head></head><body>" + ssr + "</body></html>",
};
Object.assign(files, symbolModules(byComponent));

const KEPT = [".pos", ".and", ".frag", ".lazy"];
const mark = (page: Page) => page.evaluate((sels) => sels.forEach((s) => ((document.querySelector(s) as unknown as Record<string, boolean>).__m = true)), KEPT);
const marked = (page: Page) =>
  page.evaluate((sels) => sels.filter((s) => (document.querySelector(s) as unknown as Record<string, boolean> | null)?.__m !== true), KEPT);
const text = (page: Page, sel: string) => page.evaluate((s) => document.querySelector(s)?.textContent ?? "<missing>", sel);

test("compiled shape: conditional children with a JSX operand are `_cond` accessors", () => {
  assert.equal(csr.code.split("__rivet_cond(").length - 1, 7);
  // Resumed: binding symbols return the `_cond` accessor (`symbol_cond_v2`), so the resumed region re-runs only on
  // a branch change.
  const page = files["/c/Page.js"] as string;
  assert.equal(page.match(/export const Page\$\w+ = \(n\) => __rivet_cond\(/g)?.length, 5, page);
  // Server output keeps its markers (text binding `<!--r1-->1<!--/-->`): ternaries are not branches there.
  assert.match(ssr.replace(/<!--[^>]*-->/g, ""), /<b class="pos">pos 1<\/b>/);
});

for (const path of ["/csr", "/"])
  test(`${path === "/" ? "resumed" : "client"} page: a test read that keeps the branch keeps its nodes`, async () => {
    await withPage(files, async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test" + path);
      await page.waitForFunction(() => document.querySelector(".pos"));
      // Resumed: the first change may re-create a region (docs/guides/resumability.md) — mark after it.
      await page.click("#inc");
      await page.waitForFunction(() => document.querySelector("#value")?.textContent === "2");
      await mark(page);
      assert.equal(await text(page, "#nest"), "small");
      await page.click("#inc"); // 3: nested inner switches small → big, everything else keeps its branch
      await page.waitForFunction(() => document.querySelector("#value")?.textContent === "3");
      assert.deepEqual(await marked(page), [], "branches kept after n = 3");
      assert.equal(await text(page, "#tern"), "pos 3");
      assert.equal(await text(page, "#nest"), "big");
      await page.click("#inc");
      await page.waitForFunction(() => document.querySelector("#value")?.textContent === "4");
      assert.deepEqual(await marked(page), [], "branches kept after n = 4");
      assert.deepEqual(errors, []);
    });
  });
