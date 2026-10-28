import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const source = await readFile(new URL("./derived/shortcut.tsx", import.meta.url), "utf8");
const compiled = hasDerivedModel() ? test : test.skip;
const resume = { module: "src/shortcut.tsx", boundaries: ["Shortcut"], independent: ["Shortcut"] };

for (const delayed of ["/rt.js", "/shortcut.js"]) {
  compiled(`a body shortcut during the first click's adoption reaches its window listener (${delayed} held)`, async () => {
    const server = compile(source, { target: "server", filename: "shortcut.tsx", resume } as never);
    const dom = compile(source, { target: "dom", filename: "shortcut.tsx", resume } as never);
    assert.deepEqual(server.diagnostics, []);
    assert.deepEqual(dom.diagnostics, []);
    const { Shortcut } = await importServer<{ Shortcut: () => ServerValue }>(server.code);
    const html = (await derivedToString(() => Shortcut(), {
      manifest: { hash: "t", runtime: "/rt.js", symbols: { "src/shortcut.tsx#Shortcut": "/shortcut.js" } },
      preload: { lean: true },
    })) as string;
    assert.ok(!/<script type="rivet\/boundaries"[^>]*data-boot/.test(html), "standalone:false must not boot at idle");
    let release!: () => void;
    const cold = new Promise<void>((resolve) => (release = resolve));
    await withPage(
      {
        ...DERIVED_BUILD,
        "/": "<!doctype html><html><body>" + html + "</body></html>",
        "/rt.js": 'export { default } from "/dom-derived.ts";',
        "/shortcut.js": rewrite(dom.code),
      },
      async (page, requests) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto("http://rivet.test/");
        await page.keyboard.press("Control+Shift+KeyE");
        assert.ok(!requests.includes("/rt.js"), "a key outside boundaries does not start the runtime");
        await page.click("#start");
        assert.equal(await page.evaluate(() => document.activeElement === document.body), true);
        await page.keyboard.press("Control+Shift+KeyE");
        assert.equal(await page.textContent("#clicks"), "0", "the first click still waits for its chunk");
        release();
        await page.waitForFunction(() => document.querySelector("#clicks")!.textContent === "1");
        await page.waitForFunction(() => document.querySelector("#keys")!.textContent === "1", null, { timeout: 2000 });
        // The next body shortcut is live; a key inside the wrapper also runs exactly once (delegated + window).
        await page.keyboard.press("Control+Shift+KeyE");
        assert.equal(await page.textContent("#keys"), "2");
        await page.focus("#inside");
        await page.keyboard.press("Control+Shift+KeyE");
        assert.equal(await page.textContent("#keys"), "3");
        assert.deepEqual(errors, []);
      },
      { delays: { [delayed]: cold } },
    );
  });
}
