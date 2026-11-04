// Fill routes (`export const fill = true`), end to end (production build of fixture-fill, node adapter, Chromium): the
// server markup marks the regions of a route that fills, its page root takes the layout's content area, client
// navigation moves the mark, and a more specific route that does not fill wins over a parameter route that does.
import { test } from "vitest";
import { steps } from "@rivetjs/testing/steps";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { build } from "vite";
import { chromium } from "playwright";
import { start } from "../adapters/node.ts";
import { generate } from "../build/codegen.ts";
import { routeTable } from "../build/routes.ts";

const root = new URL("./fixture-fill/", import.meta.url).pathname;
const configFile = root + "vite.config.ts";

test("codegen: no fill = no file, no import; every route filling = a constant attribute without `_fill`", () => {
  const app = (flags: [string, string[]][]) => generate(routeTable(["index.tsx", "b.tsx"], new Map(flags)), { routesDir: "src/routes" }).files;
  const none = app([]);
  assert.equal(none["fill.css"], undefined);
  assert.doesNotMatch(none["app.tsx"]!, /fill/);
  const all = app([
    ["index.tsx", ["fill"]],
    ["b.tsx", ["fill"]],
  ]);
  assert.match(all["fill.css"]!, /\[data-rivet-fill\]/);
  assert.match(all["app.tsx"]!, /data-rivet-fill=""/);
  assert.doesNotMatch(all["app.tsx"]!, /_fill/);
  const mixed = app([["b.tsx", ["fill"]]]);
  assert.match(mixed["app.tsx"]!, /_fill\(router, \[\[/);
  assert.match(mixed["app.tsx"]!, /data-rivet-fill=\{fill\(\)\}/);
  // The flag is no server export.
  assert.doesNotMatch(mixed["routes.ts"]!, /serverExports/);
});

test(
  "fill routes: regions marked on the server and on navigation, the page takes the content area",
  steps(async (t) => {
    await rm(root + "dist", { recursive: true, force: true });
    await build({ root, configFile, logLevel: "silent" });
    await build({ root, configFile, logLevel: "silent", build: { ssr: true } });
    const app = await start({ dist: root + "dist", port: 0, onError: () => {} });
    const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
    try {
      await t.test("server markup", async () => {
        const html = async (path: string) => (await fetch(app.url + path)).text();
        assert.match(await html("/full"), /<div data-rivet-routes=""[^>]* data-rivet-fill=""/);
        assert.doesNotMatch(await html("/"), /<div[^>]* data-rivet-fill=/);
        assert.match(await html("/deep/page"), /data-rivet-outlet="1"[^>]* data-rivet-fill=""/);
        assert.match(await html("/x/any"), /data-rivet-fill=""/);
        assert.doesNotMatch(await html("/x/plain"), /<div[^>]* data-rivet-fill=/, "the static route wins over the filling parameter route");
      });
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const height = (selector: string) => page.evaluate((s) => document.querySelector(s)!.getBoundingClientRect().height, selector);
      const shown = (name: string) => page.waitForFunction((name) => document.querySelector("#page")?.textContent === name, name);
      await t.test("first load: the page root fills", async () => {
        await page.goto(app.url + "/full");
        assert.equal(await height("#page"), 360);
      });
      await t.test("navigation moves the mark", async () => {
        await page.click('a[href="/"]');
        await shown("Home");
        assert.equal(await page.getAttribute("[data-rivet-routes]", "data-rivet-fill"), null);
        assert.ok((await height("#page")) < 100);
        await page.click('a[href="/full"]');
        await shown("Full");
        assert.equal(await page.getAttribute("[data-rivet-routes]", "data-rivet-fill"), "");
        assert.equal(await height("#page"), 360);
      });
      await t.test("a layout's flag covers its pages and every region up to the root", async () => {
        await page.click('a[href="/deep/page"]');
        await shown("Deep");
        assert.equal(await height("#deep"), 360);
        assert.equal(await page.getAttribute('[data-rivet-outlet="1"]', "data-rivet-fill"), "");
      });
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await app.close();
    }
  }),
);
