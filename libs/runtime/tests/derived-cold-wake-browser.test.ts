import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, hasWebkit, rewrite, withPage } from "./resume/harness.ts";

const source = await readFile(new URL("./derived/cold-wake.tsx", import.meta.url), "utf8");
async function build(name: "Keys" | "Scroll") {
  const resume = { module: "src/cold-wake.tsx", boundaries: [name], independent: [name] };
  const server = compile(source, { target: "server", filename: "cold-wake.tsx", resume } as never);
  const dom = compile(source, { target: "dom", filename: "cold-wake.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const module = await importServer<Record<string, () => ServerValue>>(server.code);
  const html = await derivedToString(() => module[name]!(), {
    manifest: { hash: "t", runtime: "/rt.js", symbols: { ["src/cold-wake.tsx#" + name]: "/fixture.js" } },
    preload: { lean: true },
  });
  return {
    ...DERIVED_BUILD,
    "/": '<!doctype html><html><body><div id="outside" tabindex="0">Outside</div>' + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/fixture.js": rewrite(dom.code),
  };
}

for (const engine of ["chromium", "webkit"] as const) {
  const browserTest = hasDerivedModel() && (engine !== "webkit" || hasWebkit()) ? test : test.skip;
  for (const delayed of ["/rt.js", "/fixture.js"]) {
    browserTest(`cold paired keyup without data-events (${engine}, ${delayed} held)`, async () => {
      const served = await build("Keys");
      assert.ok(!/data-events="[^"]*keyup/.test(served["/"]), "context helper must not list keyup for the page");
      let release!: () => void;
      const cold = new Promise<void>((resolve) => (release = resolve));
      await withPage(
        served,
        async (page, requests) => {
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.goto("http://rivet.test/");
          await page.dispatchEvent("#a", "keyup", { key: "ArrowUp", code: "ArrowUp" });
          assert.ok(!requests.includes("/rt.js"), "an unpaired keyup does not boot");
          await page.evaluate(() => {
            for (const [id, type, key] of [
              ["a", "keydown", "ArrowUp"],
              ["a", "keydown", "ArrowDown"],
              ["a", "keydown", "ArrowUp"], // Repeat still has only one release.
              ["a", "keyup", "Escape"], // A different code must stay native.
              ["a", "keydown", "Tab"],
              ["b", "keyup", "Tab"], // A release after focus moves stays native and clears its pair.
              ["a", "keyup", "ArrowUp"],
              ["a", "keyup", "ArrowDown"],
            ])
              document.getElementById(id!)!.dispatchEvent(new KeyboardEvent(type!, { key, code: key, bubbles: true, cancelable: true }));
          });
          assert.equal(await page.textContent("#log"), "");
          release();
          const expected = "keydown:a:ArrowUp keydown:a:ArrowDown keydown:a:ArrowUp keydown:a:Tab keyup:a:ArrowUp keyup:a:ArrowDown ";
          await page.waitForFunction((text) => document.querySelector("#log")!.textContent === text, expected, { timeout: 3000 });
          await page.focus("#a");
          await page.keyboard.press("ArrowUp");
          assert.equal(await page.textContent("#log"), expected + "keydown:a:ArrowUp keyup:a:ArrowUp ");
          assert.deepEqual(errors, []);
        },
        { engine, delays: { [delayed]: cold } },
      );
    });
  }
  browserTest(`cold non-bubbling helper scroll adopts and replays once (${engine})`, async () => {
    const served = await build("Scroll");
    let release!: () => void;
    const cold = new Promise<void>((resolve) => (release = resolve));
    await withPage(
      served,
      async (page, requests) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto("http://rivet.test/");
        await page.dispatchEvent("#outside", "scroll", { bubbles: false });
        assert.ok(!requests.includes("/rt.js"), "an unrelated scroll does not boot");
        await page.dispatchEvent("#scroll", "scroll", { bubbles: false });
        assert.equal(await page.textContent("#count"), "0");
        release();
        await page.waitForFunction(() => document.querySelector("#count")!.textContent === "1", null, { timeout: 3000 });
        await page.dispatchEvent("#scroll", "scroll", { bubbles: false });
        assert.equal(await page.textContent("#count"), "2");
        assert.deepEqual(errors, []);
      },
      { engine, delays: { "/fixture.js": cold } },
    );
  });
}
