// Slots in the browser: CSR mount (lazy slot props, scoped slots, context from the render site).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile } from "@rivetjs/compiler";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

interface TestWindow {
  __kept?: boolean;
  __componentRuns?: unknown;
}

const source = await readFile(new URL("./resume/slots-fixture.tsx", import.meta.url), "utf8");
const csr = compile(source, { target: "dom", filename: "slots-fixture.tsx" });
assert.deepEqual(csr.diagnostics, []);
const files: Record<string, Served> = {
  "/csr.mjs": rewrite(csr.code),
  "/csr": `<!doctype html><html><body><div id="app"></div><script type="module">
    import { mount } from "/dom.ts"; import { Page, Context } from "/csr.mjs";
    mount(() => [Page(), Context()], document.getElementById("app"));
  </script></body></html>`,
};

const text = (selector: string) => `document.querySelector(${JSON.stringify(selector)})?.textContent`;

test("CSR: named, default (function child), scoped slots and fallbacks; slot content updates and sees child context", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/csr");
    await page.waitForFunction(() => document.querySelector("#title"));
    assert.equal((await page.textContent("#title"))!.trim(), "Hello");
    assert.equal(await page.$("#body"), null);
    await page.click("#toggle");
    await page.waitForFunction(() => document.querySelector("#foot"));
    assert.equal((await page.textContent("#n"))!.trim(), "1");
    await page.click("#inc");
    await page.waitForFunction(`${text("#n")} === "2"`);
    await page.waitForFunction(`${text("#foot")}.trim() === "2 items"`);
    assert.deepEqual(await page.$$eval("#rows li", (lis) => lis.map((li) => li.textContent)), ["0:a", "1:b"]);
    await page.click("#add");
    await page.waitForFunction(() => document.querySelectorAll("#rows li").length === 3);
    assert.deepEqual(await page.$$eval("#rows li", (lis) => lis.map((li) => li.textContent)), ["0:a", "1:b", "2:c"]);
    assert.equal(await page.textContent("#tone"), "child");
    assert.deepEqual(errors, []);
  });
});
