// Cold events (handlers still loading) replay in the order they were dispatched, whatever order
// their chunks arrive in: keys typed into an input run keydown / input handlers per key, in sequence.
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

const source = await readFile(new URL("./resume/cold-order-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/cold-order.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/cold-order.tsx").code);
const manifest: ResumeManifest = {
  hash: "cold-order",
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

test("cold keydown / input events replay in dispatch order when the keydown chunk arrives last", async () => {
  await withPage(
    files,
    async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/");
      await page.focus("#in");
      await page.keyboard.type("ab", { delay: 30 });
      await page.waitForFunction(() => document.querySelector("#log")!.textContent!.split(",").length === 4, undefined, { timeout: 5000 });
      assert.equal(await page.evaluate(() => document.querySelector("#log")!.textContent), "down:a,input:a,down:b,input:b");
      assert.deepEqual(errors, []);
    },
    { delays: { "/c/Outer.js": 600 } },
  );
});
