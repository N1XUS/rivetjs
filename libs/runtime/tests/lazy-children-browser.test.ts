// Lazy component children (compiler): `<Themed><ToneOf/></Themed>` evaluates the child where Themed
// renders it, inside its Provider — on the server, in DOM client renders and on resumed pages.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compile } from "@rivetjs/compiler";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = await readFile(new URL("./resume/lazy-children-fixture.tsx", import.meta.url), "utf8");
const csr = compile(source, { target: "dom", filename: "lazy-children-fixture.tsx" });
assert.deepEqual(csr.diagnostics, []);
const dom = compileResume(source, "dom", "src/lazy.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/lazy.tsx").code);
const byComponent = symbolChunks(dom.symbols);
const manifest: ResumeManifest = {
  hash: "lazy",
  runtime: "/rt.js",
  symbols: symbolUrls(dom.symbols),
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
Object.assign(files, symbolModules(byComponent));

const tones = (): string[] => Array.from(document.querySelectorAll(".tone"), (el) => el.textContent ?? "");

test("compiled shape: lazy children are passed as an untracked thunk", () => {
  assert.match(csr.code, /__rivet_c\(Themed, \{ children: __rivetSlot\(\(\) => /);
});

test("server: a plain JSX child reads the context its parent component provides", () => {
  assert.match(ssr, /<div class="themed"><i class="tone">themed<\/i><b id="n">/);
  // The lazy children slot is a resumable function: no "rendered content is not serializable" error.
  assert.doesNotMatch(ssr, /class="tone">default/);
});

for (const path of ["/csr"]) {
  test(`client ${path}: child context from the parent's Provider; children re-created per region`, async () => {
    await withPage(files, async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test" + path);
      await page.waitForFunction(() => document.querySelector("#n"));
      assert.deepEqual(await page.evaluate(tones), ["themed"]);
      assert.equal(await page.textContent("#n"), "1");
      await page.click("#inc");
      await page.waitForFunction(() => document.querySelector("#late"));
      assert.equal(await page.textContent("#n"), "2");
      assert.deepEqual(await page.evaluate(tones), ["themed", "themed"]);
      assert.deepEqual(errors, []);
    });
  });
}

test("resume: bindings inside lazy children resume; a re-created region renders lazy children with context", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    assert.deepEqual(await page.evaluate(tones), ["themed"]);
    await page.click("#inc");
    await page.waitForFunction(() => document.querySelector("#late"));
    assert.equal(await page.textContent("#n"), "2");
    assert.deepEqual(await page.evaluate(tones), ["themed", "themed"]);
    assert.deepEqual(errors, []);
  });
});
