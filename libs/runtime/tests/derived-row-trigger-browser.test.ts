import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, hasWebkit, rewrite, withPage } from "./resume/harness.ts";

const source = await readFile(new URL("./derived/row-trigger.tsx", import.meta.url), "utf8");
const resume = { module: "row-trigger.tsx", boundaries: ["App", "Sentinel"], independent: ["App"] };
async function files(when: "visible" | "idle" | "load") {
  const server = compile(source, { target: "server", filename: "row-trigger.tsx", resume } as never);
  const dom = compile(source, { target: "dom", filename: "row-trigger.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { App } = await importServer<{ App: (props: { when: string }) => ServerValue }>(server.code);
  const html = await derivedToString(() => App({ when }), {
    manifest: { runtime: "/rt.js", symbols: { "row-trigger.tsx#App": "/page.js", "row-trigger.tsx#Sentinel": "/page.js" } },
    preload: { lean: true },
  });
  return {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/page.js": rewrite(dom.code),
  };
}

for (const engine of ["chromium", "webkit"] as const) {
  for (const when of ["visible", "idle", "load"] as const) {
    (engine === "webkit" && !hasWebkit() ? test.skip : test)(`a dependent lazy row wakes on its own ${when} trigger (${engine})`, async () => {
      await withPage(
        await files(when),
        async (page) => {
          const errors: string[] = [];
          page.on("pageerror", (e) => errors.push(e.message));
          await page.goto("http://rivet.test/");
          await page.evaluate(() => {
            (window as any).__sentinel = document.querySelector("#sentinel");
          });
          if (when === "visible") {
            await page.click("#boot");
            assert.equal(await page.getAttribute("#sentinel", "data-installed"), null, "offscreen sentinel stays lazy after parent adopts");
            await page.evaluate(() => document.querySelector("#sentinel")!.scrollIntoView());
          }
          await page.waitForFunction(() => document.querySelector("#sentinel")!.getAttribute("data-installed") === "yes", null, { timeout: 3000 });
          assert.equal(await page.textContent("#count"), "1", "effect installed once");
          await page.evaluate(() => window.dispatchEvent(new Event("ping")));
          await page.waitForFunction(() => document.querySelector("#count")!.textContent === "2", null, { timeout: 3000 });
          assert.equal(await page.evaluate(() => (window as any).__sentinel === document.querySelector("#sentinel")), true, "server node retained");
          assert.equal(
            await page.evaluate(() => [...document.querySelectorAll(".ordinary")].filter((el) => (el as any).$$click).length),
            0,
            "the 1000 ordinary rows stay lazy",
          );
          assert.deepEqual(errors, []);
        },
        { engine },
      );
    });
  }
}
