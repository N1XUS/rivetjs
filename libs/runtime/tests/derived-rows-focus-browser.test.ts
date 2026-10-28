// A lazy For's rows gain boundary anchors as they adopt. Its first reconcile must
// use those live ranges, keeping a focused server node attached while a new key appears.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, hasWebkit, rewrite, withPage } from "./resume/harness.ts";

type FocusWindow = Window & { kept: Element; detached?: boolean };
const engines = hasWebkit() ? (["chromium", "webkit"] as const) : (["chromium"] as const);
for (const engine of engines)
  for (const key of ["End", "PageDown"]) {
    test(`derived For (${engine}, ${key}): first reconcile keeps focus after rows gain adoption anchors`, async () => {
      const server = await readFile(new URL("./derived/rows-focus.server.tsx", import.meta.url), "utf8");
      const client = await readFile(new URL("./derived/rows-focus.dom.tsx", import.meta.url), "utf8");
      const ssr = compile(server, { target: "server", filename: "focus.server.tsx" });
      const dom = compile(client, { target: "dom", filename: "focus.dom.tsx" });
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
          await page.click('[data-key="1"]');
          await page.waitForFunction(() => document.querySelector('[data-key="1"][aria-pressed="true"]'));
          assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-key")), "1");
          await page.evaluate(() => {
            const focused = document.activeElement!;
            (window as unknown as FocusWindow).kept = focused;
            const observer = new MutationObserver((records) => {
              if (records.some((record) => Array.from(record.removedNodes).some((node) => node.contains(focused))))
                (window as unknown as FocusWindow).detached = true;
            });
            observer.observe(document.querySelector("#list")!, { childList: true });
          });
          await page.keyboard.press(key);
          await page.waitForSelector('[data-key="9999"]', { timeout: 3000 });
          assert.deepEqual(errors, []);
          assert.equal(
            await page.evaluate(() => document.activeElement === (window as unknown as FocusWindow).kept),
            true,
            "the retained row must keep DOM focus",
          );
          assert.equal(await page.evaluate(() => !!(window as unknown as FocusWindow).detached), false, "the retained row must never detach");
          await page.keyboard.press("Home");
          await page.waitForFunction(() => document.querySelectorAll('[role="option"]').length === 1);
          assert.equal(await page.evaluate(() => document.activeElement === (window as unknown as FocusWindow).kept), true);
          assert.equal(await page.evaluate(() => !!(window as unknown as FocusWindow).detached), false);
          await page.keyboard.press("Delete");
          await page.waitForFunction(() => document.querySelectorAll('[role="option"]').length === 0);
          assert.deepEqual(errors, []);
        },
        { engine },
      );
    });
  }
