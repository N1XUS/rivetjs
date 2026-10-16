// Revalidation by key end to end: a production build of fixture-depends (resumed pages) served by
// the node adapter and driven in Chromium. Loaders call `event.depends(key)`; `invalidate(key | keys
// | predicate)` reruns only the matching loaders (counted on the server) in one data request:
// kept layouts invalidated by key update in place, a page whose loader did not match is not
// re-rendered, nothing matching sends no request, `invalidate()` still reruns everything, and
// warmed prefetch data is dropped.
import { test } from "vitest";
import { steps } from "@rivetjs/testing/steps";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { build } from "vite";
import { chromium } from "playwright";
import { start } from "../adapters/node.ts";

const root = new URL("./fixture-depends/", import.meta.url).pathname;
const configFile = root + "vite.config.ts";

test("invalidate(key): only loaders that depend on a matching key rerun", steps(async (t) => {
  await rm(root + "dist", { recursive: true, force: true });
  await build({ root, configFile, logLevel: "silent" });
  await build({ root, configFile, logLevel: "silent", build: { ssr: true } });
  const app = await start({ dist: root + "dist", port: 0, onError: () => {} });
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const errors: string[] = [], documents: string[] = [], data: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (request.resourceType() === "document") documents.push(url.pathname + url.search);
      if (url.searchParams.get("_rivet") === "data") {
        url.searchParams.delete("_rivet");
        data.push(decodeURIComponent(url.pathname + url.search));
      }
    });
    const counts = async (): Promise<Record<string, number>> => (await fetch(app.url + "/counts")).json() as Promise<Record<string, number>>;
    const ready = async () => {
      // Z1: a resumed router app boots nothing at idle; a press on a link starts the runtime + router (intent).
      await page.dispatchEvent("a[href^='/']", "pointerdown");
      await page.waitForFunction(() => (document as unknown as { $r?: { r(): unknown } }).$r?.r());
      await page.evaluate(() => new Promise((done) => requestIdleCallback(() => setTimeout(done, 50))));
    };
    const click = (selector: string) => page.evaluate((s) => document.querySelector<HTMLElement>(s)!.click(), selector);
    const invalidated = async (button: string) => {
      await page.evaluate(() => delete document.documentElement.dataset.done);
      await click("#inv-" + button);
      await page.waitForFunction((name) => document.documentElement.dataset.done === name, button);
    };
    const text = (selector: string) => page.textContent(selector);
    const mark = (selector: string) => page.evaluate((s) => ((document.querySelector(s) as HTMLElement & { __mark?: number }).__mark = 1), selector);
    const marked = (selector: string) => page.evaluate((s) => (document.querySelector(s) as (HTMLElement & { __mark?: number }) | null)?.__mark === 1, selector);

    await t.test("server render: the loaders' keys travel with the layout state", async () => {
      const html = await (await fetch(app.url + "/shop/a")).text();
      for (const key of ["session", "cart", "/api/items/a"]) assert.ok(html.includes(JSON.stringify(key)), key);
    });

    await page.goto(app.url + "/shop/a");
    await ready();
    const base = await counts();

    await t.test("a layout key (resumed page, before any navigation): that layout reruns in place, the page stays", async () => {
      await mark("#shop");
      await mark("#page");
      await page.click("#shop-count");
      await invalidated("cart");
      assert.deepEqual(data, ["/shop/a?_rivet_keep=/,."], "one request keeping the root layout and the page");
      const c = await counts();
      assert.equal(c.shop, base.shop! + 1);
      assert.equal(c.root, base.root);
      assert.equal(c.a, base.a);
      assert.equal(await text("#shop-loads"), String(c.shop));
      assert.ok(await marked("#shop"), "layout kept its DOM");
      assert.equal(await text("#shop-count"), "Count 1", "and its state");
      assert.ok(await marked("#page"), "page not re-rendered");
    });

    await t.test("a predicate matching the page's key: the page reruns, both layouts are kept", async () => {
      data.length = 0;
      const before = await counts();
      await invalidated("api");
      assert.deepEqual(data, ["/shop/a?_rivet_keep=/,/shop"]);
      const c = await counts();
      assert.deepEqual([c.root, c.shop, c.a], [before.root, before.shop, before.a! + 1]);
      assert.equal(await text("#page-n"), String(c.a));
      assert.ok(await marked("#shop"));
      assert.equal(await text("#shop-count"), "Count 1");
    });

    await t.test("the root layout (kept by navigation) reruns when its key matches", async () => {
      data.length = 0;
      const before = await counts();
      await invalidated("session");
      assert.deepEqual(data, ["/shop/a?_rivet_keep=/shop,."]);
      const c = await counts();
      assert.deepEqual([c.root, c.shop, c.a], [before.root! + 1, before.shop, before.a]);
      assert.equal(await text("#root-loads"), String(c.root));
    });

    await t.test("a list of keys", async () => {
      data.length = 0;
      const before = await counts();
      await invalidated("both");
      assert.deepEqual(data, ["/shop/a?_rivet_keep=."]);
      const c = await counts();
      assert.deepEqual([c.root, c.shop, c.a], [before.root! + 1, before.shop! + 1, before.a]);
    });

    await t.test("no loader depends on the key: no request", async () => {
      data.length = 0;
      const before = await counts();
      await invalidated("none");
      assert.deepEqual(data, []);
      assert.deepEqual(await counts(), before);
    });

    await t.test("invalidate() without arguments still reruns every loader", async () => {
      data.length = 0;
      const before = await counts();
      await invalidated("all");
      assert.deepEqual(data, ["/shop/a"]);
      const c = await counts();
      assert.deepEqual([c.root, c.shop, c.a], [before.root! + 1, before.shop! + 1, before.a! + 1]);
      assert.ok(await marked("#shop"));
    });

    await t.test("invalidate(key) drops prefetched route data", async () => {
      data.length = 0;
      await page.hover('nav a[href="/shop/b"]');
      for (let i = 0; i < 100 && !data.length; i++) await page.waitForTimeout(20);
      assert.deepEqual(data, ["/shop/b?_rivet_keep=/,/shop"], "warmed");
      await invalidated("cart");
      const before = await counts();
      await click('nav a[href="/shop/b"]');
      await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Page b");
      assert.equal(data.length, 3, "the navigation fetched again: " + data.join(" "));
      assert.equal(data[2], "/shop/b?_rivet_keep=/,/shop");
      assert.equal((await counts()).b, before.b! + 1);
    });

    await t.test("after client navigation: keys of kept layouts are remembered", async () => {
      data.length = 0;
      const before = await counts();
      await mark("#page");
      await invalidated("cart");
      assert.deepEqual(data, ["/shop/b?_rivet_keep=/,."]);
      const c = await counts();
      assert.deepEqual([c.root, c.shop, c.b], [before.root, before.shop! + 1, before.b]);
      assert.ok(await marked("#page"));
    });

    await t.test("a page whose loaders depend on nothing matching: no request", async () => {
      await click('nav a[href="/plain"]');
      await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Plain");
      data.length = 0;
      await invalidated("cart");
      await invalidated("api");
      assert.deepEqual(data, []);
      await invalidated("session");
      assert.deepEqual(data, ["/plain?_rivet_keep=."]);
    });

    await t.test("no document loads, no errors", async () => {
      assert.deepEqual(documents, ["/shop/a"]);
      assert.deepEqual(errors, []);
    });
  } finally {
    await browser.close();
    await app.close();
  }
}));
