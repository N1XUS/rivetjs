// Conditional boundaries (M6-PARITY 6b): a boundary without a change source of its own (`COND`) keeps its record only
// for a live instance — a prop getter or slot content reading a source from outside it, a kept boundary below. A static
// instance ships no record (a page of static instances only: no tail, no runtime); when an ancestor adopts, the browser
// adopts a static instance as a unit of its own over its server nodes (rows whose items change keep updating). Fixture:
// `tests/derived/cond.{server,dom}.tsx`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const fixture = (name: string): Promise<string> => readFile(new URL("./derived/" + name, import.meta.url), "utf8");
const manifest = { hash: "t", runtime: "/rt.js", symbols: { App: "/page.js", Label: "/page.js", Box: "/page.js" } };
type Mod = { App: () => ServerValue; Static: () => ServerValue };

async function server(): Promise<Mod> {
  const out = compile(await fixture("cond.server.tsx"), { target: "server", filename: "cond.server.tsx" });
  assert.deepEqual(out.diagnostics, []);
  return importServer<Mod>(out.code);
}
const tailOf = (html: string) => JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!);

test("server: an instance that read a source from outside keeps its record, the others ship none", async () => {
  const { App } = await server();
  const html = (await derivedToString(() => App(), { manifest })) as string;
  const tail = tailOf(html);
  // App 1; Labels 2, 3 dropped (server props are values the caller computed: a live one updates through App's adopt
  // run, which runs it inline); Box 4 kept (its slot read `theme` in its own unit); row Labels 5, 6 dropped.
  assert.deepEqual(
    tail.b.map((r: unknown[]) => r.slice(0, 4)),
    [
      [1, 0, 1, "App"],
      [4, 1, 0, "Box"],
    ],
  );
  assert.ok(html.includes("<!--b2-->"), "markers stay");
});

test("server: a page of static conditional instances ships no tail and no loader", async () => {
  const { Static } = await server();
  const html = (await derivedToString(() => Static(), { manifest })) as string;
  assert.ok(!html.includes("rivet/boundaries"), html);
  assert.ok(!html.includes("<script"), html);
});

test("browser: live instances update, static ones adopt with their ancestor", async () => {
  const { App } = await server();
  const out = compile(await fixture("cond.dom.tsx"), { target: "dom", filename: "cond.dom.tsx" });
  assert.deepEqual(out.diagnostics, []);
  const files = {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + ((await derivedToString(() => App(), { manifest })) as string) + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/page.js": rewrite(out.code),
  };
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("http://rivet.test/");
    await page.evaluate(() => ((document.querySelector(".label.static") as unknown as Record<string, number>).__t = 1));
    await page.click("#dark");
    await page.waitForFunction(() => document.querySelector(".label.live")!.textContent === "dark");
    assert.equal(await page.textContent("#slot"), "dark");
    assert.equal(await page.textContent(".label.static"), "fixed");
    assert.equal(await page.evaluate(() => (document.querySelector(".label.static") as unknown as Record<string, number>).__t), 1, "server node kept");
    await page.waitForFunction(() => document.querySelector(".label.row1")!.textContent === "one!");
    assert.equal(await page.textContent(".label.row2"), "two!");
    assert.deepEqual(errors, []);
  });
});
