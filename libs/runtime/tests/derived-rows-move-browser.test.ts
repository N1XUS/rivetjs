// A resumed keyed For that reorders so the row holding document focus moves (insertBefore blurs it; its focusout is
// delegated and runs mid-reconcile). Every row must still appear once, in the new order, and keep focus afterwards.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, hasWebkit, rewrite, withPage } from "./resume/harness.ts";

const engines = hasWebkit() ? (["chromium", "webkit"] as const) : (["chromium"] as const);
for (const engine of engines)
  test(`derived For (${engine}): moving the focused row renders every row once`, async () => {
    const server = await readFile(new URL("./derived/rows-move.server.tsx", import.meta.url), "utf8");
    const client = await readFile(new URL("./derived/rows-move.dom.tsx", import.meta.url), "utf8");
    const ssr = compile(server, { target: "server", filename: "move.server.tsx" });
    const dom = compile(client, { target: "dom", filename: "move.dom.tsx" });
    assert.deepEqual(ssr.diagnostics, []);
    assert.deepEqual(dom.diagnostics, []);
    const { App } = await importServer<{ App: () => ServerValue }>(ssr.code);
    const manifest = { hash: "t", runtime: "/rt.js", symbols: { App: "/page.js", View: "/page.js" } };
    await withPage(
      {
        ...DERIVED_BUILD,
        "/": "<!doctype html><body>" + (await derivedToString(() => App(), { manifest })) + "</body>",
        "/rt.js": 'export { default } from "/dom-derived.ts";',
        "/page.js": rewrite(dom.code),
      },
      async (page) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto("http://rivet.test/");
        // Cold: the focused row's boundary is not adopted (focus alone does not adopt it), the list is still lazy.
        await page.focus('[data-key="0"]');
        assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-key")), "0");
        const keys = () => page.$$eval("#list > [data-key]", (els) => els.map((el) => el.getAttribute("data-key")));
        await page.keyboard.press("ArrowDown");
        await page
          .waitForFunction(() => document.querySelector("#list > [data-key]")?.getAttribute("data-key") === "1", null, { timeout: 2000 })
          .catch(() => {});
        assert.deepEqual(await keys(), ["1", "0", "2"]);
        assert.deepEqual(await page.$$eval("#list > i", (els) => els.map((el) => el.textContent)), ["1", "0", "2"]);
        // Warm: the same move back, with the row now adopted by the earlier work.
        await page.focus('[data-key="0"]');
        await page.keyboard.press("ArrowDown");
        await page
          .waitForFunction(() => document.querySelector("#list > [data-key]")?.getAttribute("data-key") === "0", null, { timeout: 2000 })
          .catch(() => {});
        assert.deepEqual(await keys(), ["0", "1", "2"]);
        assert.deepEqual(errors, []);
      },
      { engine },
    );
  });
