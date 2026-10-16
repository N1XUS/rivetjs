// Removed regions (resumed pages): server content inside a region the browser replaces (ternary child, keyed Show, Show
// fallback) binds a signal its replacement binds too; a write after the replacement updates the replacement only — no
// "Missing resumable element", no server binding of the removed content resumed. Fixture `resume/removed-region-fixture.tsx`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile } from "@rivetjs/compiler";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { Page } from "playwright";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = await readFile(new URL("./resume/removed-region-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/removed.tsx");
const server = await importServer<Record<string, () => ServerValue>>(compileResume(source, "server", "src/removed.tsx").code);
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const manifest: ResumeManifest = {
  hash: "removed",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const csr = compile(source, { target: "dom", filename: "removed.tsx" });
const base: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/csr.mjs": rewrite(csr.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
for (const [path, symbols] of Object.entries(byComponent)) base[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

async function run(name: string, mode: "csr" | "resume"): Promise<{ texts: string[]; errors: string[] }> {
  const html = await resumableToString(() => server[name]!(), { manifest });
  const files = {
    ...base,
    "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
    "/csr": `<!doctype html><html><body><div id="app"></div><script type="module">
      import { mount } from "/dom.ts"; import { ${name} } from "/csr.mjs";
      mount(() => ${name}(), document.getElementById("app"));
    </script></body></html>`,
  };
  return withPage(files, async (page: Page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => (message.type() === "error" || message.type() === "warning") && errors.push(message.text()));
    await page.goto("http://rivet.test/" + (mode === "csr" ? "csr" : ""));
    await page.waitForFunction(() => document.querySelector(".go"));
    const texts: string[] = [];
    const step = async (button: string) => {
      const before = await page.evaluate(() => document.querySelector(".box")!.textContent);
      await page.click(button);
      await page.waitForFunction((b) => document.querySelector(".box")!.textContent !== b, before, { timeout: 1500 }).catch(() => {});
      await page.evaluate(() => new Promise((done) => setTimeout(done, 50)));
      texts.push(await page.evaluate(() => document.querySelector(".box")!.textContent!));
    };
    await step(".go");
    await step(".type");
    await step(".go");
    await step(".type");
    return { texts, errors };
  });
}

for (const name of ["Ternary", "Children", "Keyed", "Plain"]) {
  test(`${name}: a write after the region was replaced updates the replacement only`, async () => {
    for (const mode of ["csr", "resume"] as const)
      assert.deepEqual(await run(name, mode), { texts: ["gotypea", "gotypeab", "gotypeemail ab", "gotypeemail abb"], errors: [] }, mode);
  });
}
