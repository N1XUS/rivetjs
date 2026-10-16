// G4: SVG child elements returned by components (separate templates, built before they are inserted)
// rendered inside a parent's `<svg>` take the SVG namespace — client-mounted,
// server-rendered + resumed, and after a resumed page re-creates the component on its first change.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compile } from "@rivetjs/compiler";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";
import type { Page } from "playwright";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = await readFile(new URL("./resume/svg-children-fixture.tsx", import.meta.url), "utf8");
const csr = compile(source, { target: "dom", filename: "svg-children-fixture.tsx" });
assert.deepEqual(csr.diagnostics, []);
const dom = compileResume(source, "dom", "src/svg.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/svg.tsx").code);
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const manifest: ResumeManifest = {
  hash: "svg",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const page = (module: string): string => `<!doctype html><html><body><div id="app"></div><script type="module">
    import { mount } from "/dom.ts"; import { Page } from "${module}";
    mount(() => Page(), document.getElementById("app"));
  </script></body></html>`;
const ssr = await resumableToString(() => server.Page(), { manifest });
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/csr.mjs": rewrite(csr.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/csr": page("/csr.mjs"),
  "/": "<!doctype html><html><head></head><body>" + ssr + "</body></html>",
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

const SVG = "http://www.w3.org/2000/svg";
/** `tag@ns` of every element under `svg.<cls>`. */
const tree = (page: Page, cls: string) =>
  page.evaluate(
    ([cls]) =>
      [...document.querySelectorAll(`svg.${cls}, svg.${cls} *`)]
        .map((el) => el.localName + "@" + (el.namespaceURI === "http://www.w3.org/2000/svg" ? "svg" : el.namespaceURI))
        .join(","),
    [cls] as const,
  );
const expected = {
  direct: "svg@svg,path@svg,circle@svg,rect@svg,a@svg,text@svg,image@svg,use@svg,image@svg,title@svg",
  frame: "svg@svg,path@svg,path@svg",
  data: "svg@svg,path@svg,circle@svg",
  spread: "svg@svg,path@svg",
  titled: "svg@svg,title@svg,path@svg",
  late: "svg@svg,path@svg,a@svg,text@svg,image@svg,use@svg",
};
void SVG;

async function check(page: Page, classes: (keyof typeof expected)[], where: string) {
  for (const cls of classes) assert.equal(await tree(page, cls), expected[cls], `${where}: svg.${cls}`);
}

for (const path of ["/csr"]) {
  test(`client ${path}: component-returned svg children are SVG elements, also when created on a change`, async () => {
    await withPage(files, async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test" + path);
      await page.waitForFunction(() => document.querySelector("#inc"));
      await check(page, ["direct", "frame", "data", "spread", "titled"], path);
      await page.click("#inc");
      await page.waitForFunction(() => document.querySelector("svg.late"));
      await check(page, ["direct", "frame", "data", "late"], path + " after change");
      assert.deepEqual(errors, []);
    });
  });
}

test("server + resume: svg children server-rendered, and re-created after the first change", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    await check(page, ["direct", "frame", "data", "spread", "titled"], "ssr");
    await page.click("#inc");
    await page.waitForFunction(() => document.querySelector("svg.late"));
    assert.equal(await page.textContent("#inc"), "1");
    await check(page, ["direct", "frame", "data", "late"], "resumed");
    assert.deepEqual(errors, []);
  });
});
