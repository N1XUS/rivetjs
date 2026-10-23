// Lazy component children (compiler): `<Themed><ToneOf/></Themed>` evaluates the child where Themed
// renders it, inside its Provider — on the server and in DOM client renders.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderToString } from "@rivetjs/runtime/server";
import type { ServerValue } from "@rivetjs/runtime/server";
import { compile } from "@rivetjs/compiler";
import { importServer } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

const source = await readFile(new URL("./resume/lazy-children-fixture.tsx", import.meta.url), "utf8");
const csr = compile(source, { target: "dom", filename: "lazy-children-fixture.tsx" });
assert.deepEqual(csr.diagnostics, []);
const server = await importServer<{ Page(): ServerValue }>(compile(source, { target: "server", filename: "lazy-children-fixture.tsx" }).code);
const page = (module: string): string => `<!doctype html><html><body><div id="app"></div><script type="module">
    import { mount } from "/dom.ts"; import { Page } from "${module}";
    mount(() => Page(), document.getElementById("app"));
  </script></body></html>`;
const ssr = await renderToString(() => server.Page());
const files: Record<string, Served> = {
  "/csr.mjs": rewrite(csr.code),
  "/csr": page("/csr.mjs"),
};

const tones = (): string[] => Array.from(document.querySelectorAll(".tone"), (el) => el.textContent ?? "");

test("compiled shape: lazy children are passed as an untracked thunk", () => {
  assert.match(csr.code, /__rivet_c\(Themed, \{ children: __rivetSlot\(\(\) => /);
});

test("server: a plain JSX child reads the context its parent component provides", () => {
  assert.match(ssr, /<div class="themed"><i class="tone">themed<\/i><b id="n">/);
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
