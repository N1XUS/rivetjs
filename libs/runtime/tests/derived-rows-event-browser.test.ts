// Held / live events on lazy rows (M6-PARITY task 5): a click on a server row of a list whose unit already adopted (a
// reconcile prepended a client row) materialises the row and reaches its handler on the first click. Fixture:
// `tests/derived/rows.{server,dom}.tsx`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const fixture = (name: string): Promise<string> => readFile(new URL("./derived/" + name, import.meta.url), "utf8");
const manifest = { hash: "t", runtime: "/rt.js", symbols: { App: "/page.js", Tag: "/page.js" } };

async function files(): Promise<Record<string, string>> {
  const out = compile(await fixture("rows.server.tsx"), { target: "server", filename: "rows.server.tsx" });
  assert.deepEqual(out.diagnostics, []);
  const { App } = await importServer<{ App: () => ServerValue }>(out.code);
  const dom = compile(await fixture("rows.dom.tsx"), { target: "dom", filename: "rows.dom.tsx" });
  assert.deepEqual(dom.diagnostics, []);
  return {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + ((await derivedToString(() => App(), { manifest })) as string) + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/page.js": rewrite(dom.code),
  };
}
const ids = (page: import("playwright").Page) => page.evaluate(() => [...document.querySelectorAll("li")].map((li) => li.id).join(" "));

test("a first click on a server row after a reconcile prepended a row reaches the row's handler", async () => {
  await withPage(await files(), async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("http://rivet.test/");
    await page.click("#add");
    await page.waitForFunction(() => document.querySelectorAll("li").length === 3);
    assert.equal(await ids(page), "row-3 row-1 row-2");
    await page.click("#del-1");
    await page.waitForFunction(() => !document.querySelector("#row-1"), null, { timeout: 2000 }).catch(() => {});
    assert.equal(await ids(page), "row-3 row-2");
    await page.click("#row-2 .tag");
    await page.waitForFunction(() => document.querySelector("#row-2 .tag")!.textContent === "two*", null, { timeout: 2000 }).catch(() => {});
    assert.equal(await page.textContent("#row-2 .tag"), "two*");
    assert.deepEqual(errors, []);
  });
});
