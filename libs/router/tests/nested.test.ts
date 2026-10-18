// Nested layout persistence end to end: a production build of fixture-nested (resumed pages) served
// by the node adapter and driven in Chromium. Sibling navigation under routes/shop/_layout keeps the
// layout's DOM and state (counter, typed input) and skips its loader; leaving disposes it; layout
// params/data accessors update in place (routes/u/[id]/_layout); invalidate() reloads every loader;
// failures render in place under kept layouts.
import { test } from "vitest";
import { steps } from "@rivetjs/testing/steps";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { build } from "vite";
import { chromium } from "playwright";
import { start } from "../adapters/node.ts";

const root = new URL("./fixture-nested/", import.meta.url).pathname;
const configFile = root + "vite.config.ts";

test("nested layouts: persistence, reactive layout props, kept loaders", steps(async (t) => {
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
    const nav = (href: string) => click(`nav a[href="${href}"]`);
    const heading = (value: string) => page.waitForFunction((value) => document.querySelector("h1")?.textContent === value, value);
    const text = (selector: string) => page.textContent(selector);
    // Mark the layout element: a remount replaces it (the mark disappears).
    const mark = (selector: string) => page.evaluate((s) => ((document.querySelector(s) as HTMLElement & { __mark?: number }).__mark = 1), selector);
    const marked = (selector: string) => page.evaluate((s) => (document.querySelector(s) as (HTMLElement & { __mark?: number }) | null)?.__mark === 1, selector);

    await page.goto(app.url + "/shop/a");
    await ready();

    await t.test("first navigation from a resumed page keeps the server-rendered layout", async () => {
      assert.deepEqual(await counts(), { root: 1, shop: 1, a: 1 });
      await mark("#shop");
      await page.click("#shop-count");
      await page.waitForFunction(() => document.querySelector("#shop-count")?.textContent === "Count 1");
      await page.fill("#shop-input", "typed");
      await nav("/shop/b");
      await heading("Page b");
      assert.ok(await marked("#shop"), "same layout element");
      assert.equal(await text("#shop-count"), "Count 1");
      assert.equal(await page.inputValue("#shop-input"), "typed");
      assert.equal(await text("#shop-url"), "/shop/b", "layout url() follows");
      assert.equal(await text("#shop-loads"), "1", "layout data kept");
      assert.equal(await text("#root-loads"), "1");
      assert.deepEqual(await counts(), { root: 1, shop: 1, a: 1, b: 1 }, "root and shop loaders skipped");
      assert.deepEqual(data, ["/shop/b?_rivet_keep=/,/shop"]);
      assert.equal(await page.title(), "Shop B");
    });

    await t.test("later sibling navigations (and search changes) keep it too; back/forward as well", async () => {
      await nav("/shop/a");
      await heading("Page a");
      await nav("/shop/b?q=1");
      await page.waitForFunction(() => document.querySelector("#shop-url")?.textContent === "/shop/b?q=1");
      await page.goBack();
      await page.waitForFunction(() => document.querySelector("#shop-url")?.textContent === "/shop/a");
      await heading("Page a");
      assert.ok(await marked("#shop"));
      assert.equal(await text("#shop-count"), "Count 1");
      assert.equal(await page.inputValue("#shop-input"), "typed");
      const c = await counts();
      assert.equal(c.shop, 1);
      assert.equal(c.root, 1);
    });

    await t.test("invalidate() reloads every loader; the layout updates in place", async () => {
      await click("#shop-invalidate");
      await page.waitForFunction(() => document.documentElement.dataset.done === "fresh");
      await page.waitForFunction(() => document.querySelector("#shop-loads")?.textContent === "2");
      assert.ok(await marked("#shop"));
      assert.equal(await text("#shop-count"), "Count 1");
      assert.equal(await text("#root-loads"), "2");
      assert.equal(data[data.length - 1], "/shop/a", "nothing kept");
    });

    await t.test("a failure under kept layouts renders in place", async () => {
      await nav("/shop/broken");
      await page.waitForFunction(() => document.querySelector("#shop-page [role=alert]")?.textContent === "No such product");
      assert.ok(await marked("#shop"));
      await nav("/shop/a");
      await heading("Page a");
      assert.ok(await marked("#shop"));
    });

    await t.test("leaving the layout disposes it; coming back mounts a fresh one with fresh data", async () => {
      await nav("/about");
      await heading("About");
      assert.equal(await page.$("#shop"), null);
      const before = (await counts()).shop!;
      await nav("/shop/b");
      await heading("Page b");
      assert.equal(await marked("#shop"), false, "new instance");
      assert.equal(await text("#shop-count"), "Count 0");
      assert.equal((await counts()).shop, before + 1);
      assert.equal(await text("#shop-loads"), String(before + 1));
    });

    await t.test("layout params change: accessors update, state stays, its loader reruns", async () => {
      await nav("/u/1/x");
      await heading("User page x");
      await mark("#user");
      await page.click("#u-count");
      await page.waitForFunction(() => document.querySelector("#u-count")?.textContent === "U 1");
      const u = (await counts()).u!;
      await nav("/u/1/y");
      await heading("User page y");
      assert.equal((await counts()).u, u, "same params: kept");
      await nav("/u/2/x");
      await heading("User page x");
      await page.waitForFunction(() => document.querySelector("#u-params")?.textContent === "2");
      assert.ok(await marked("#user"));
      assert.equal(await text("#u-count"), "U 1");
      assert.equal(await text("#u-data"), "2:" + (u + 1));
      assert.equal((await counts()).u, u + 1);
    });

    await t.test("a failure of a reloaded layout's loader replaces the layout (rendered from the outer level)", async () => {
      await page.evaluate(() => {
        const link = document.createElement("a");
        link.href = "/u/404/x";
        link.id = "bad-user";
        document.querySelector("nav")!.append(link);
      });
      await click("#bad-user");
      await page.waitForFunction(() => document.querySelector("main [role=alert]")?.textContent === "Something went wrong");
      assert.equal(await page.$("#user"), null);
      await nav("/u/1/x");
      await heading("User page x");
      assert.equal(await text("#u-count"), "U 0");
    });

    await t.test("no document loads, no errors", async () => {
      assert.deepEqual(documents, ["/shop/a"]);
      assert.deepEqual(errors, []);
    });

    await t.test("resumed page: leaving the layout first, then sibling navigation", async () => {
      const fresh = await browser.newPage();
      const pageErrors: string[] = [];
      const loads: string[] = [];
      fresh.on("pageerror", (error) => pageErrors.push(error.message));
      const scripts: string[] = [];
      fresh.on("request", (request) => request.resourceType() === "document" && loads.push(new URL(request.url()).pathname));
      fresh.on("request", (request) => request.resourceType() !== "document" && scripts.push(new URL(request.url()).pathname));
      await fresh.goto(app.url + "/shop/a");
      // Z1, cold: nothing of the router (runtime, App chunk) runs at idle; they are only fetched (low-priority
      // modulepreload links the loader module adds after the load event, state script `data-fo`). The first link click (no intent before it) is held by
      // the loader, boots the router from the module map (no refetch) and is replayed as a client navigation.
      await fresh.waitForLoadState("networkidle");
      await fresh.evaluate(() => new Promise((done) => requestIdleCallback(() => setTimeout(done, 100))));
      assert.equal(await fresh.evaluate(() => !!(document as unknown as { $r?: { r(): unknown } }).$r?.r()), false, "runtime not booted at idle");
      const prefetched = await fresh.$$eval('link[rel="modulepreload"][fetchpriority="low"]', (links) => links.map((link) => new URL((link as HTMLLinkElement).href).pathname));
      // The App's symbols: `resume-App` in component mode, the main route chunk (`resume-route_main`) in route mode (default).
      assert.ok(prefetched.some((url) => /resume-entry/.test(url)) && prefetched.some((url) => /resume-(App|route_main)/.test(url)), prefetched.join());
      assert.deepEqual(
        scripts.filter((url) => /resume-(entry|App|route_main)/.test(url)).sort(),
        prefetched.filter((url) => /resume-(entry|App|route_main)/.test(url)).sort(),
        "runtime / App chunk only fetched (modulepreload) before the click",
      );
      const before = scripts.length;
      await fresh.evaluate(() => ((document.querySelector("#shell") as HTMLElement & { __mark?: number }).__mark = 1));
      await fresh.evaluate(() => document.querySelector<HTMLElement>('nav a[href="/u/1/x"]')!.click());
      await fresh.waitForFunction(() => document.querySelector("h1")?.textContent === "User page x");
      // (The runtime's deps module, `resume-entry-*.deps.js`, may follow the boot: a URL list, not a chunk refetch.)
      assert.deepEqual(scripts.slice(before).filter((url) => /resume-(entry|App)/.test(url) && !url.endsWith(".deps.js")), [], "the click refetches neither");
      assert.equal(await fresh.$("#shop"), null);
      assert.ok(await fresh.evaluate(() => (document.querySelector("#shell") as HTMLElement & { __mark?: number }).__mark === 1), "root layout kept");
      await fresh.evaluate(() => document.querySelector<HTMLElement>('nav a[href="/shop/b"]')!.click());
      await fresh.waitForFunction(() => document.querySelector("h1")?.textContent === "Page b");
      await fresh.evaluate(() => ((document.querySelector("#shop") as HTMLElement & { __mark?: number }).__mark = 1));
      await fresh.evaluate(() => document.querySelector<HTMLElement>('nav a[href="/shop/a"]')!.click());
      await fresh.waitForFunction(() => document.querySelector("h1")?.textContent === "Page a");
      assert.ok(await fresh.evaluate(() => (document.querySelector("#shop") as HTMLElement & { __mark?: number }).__mark === 1));
      assert.equal(await fresh.$$eval("#shop", (all) => all.length), 1);
      assert.deepEqual(pageErrors, []);
      assert.deepEqual(loads, ["/shop/a"]);
      await fresh.close();

      // Z1, intent: hovering a link boots the router (its listeners attach and see that hover), so the
      // route data prefetch starts before the click; the click then navigates on the armed router.
      const hovered = await browser.newPage();
      const data: string[] = [],
        hoverErrors: string[] = [];
      hovered.on("request", (request) => /[?&]_rivet=data/.test(request.url()) && data.push(new URL(request.url()).pathname));
      hovered.on("pageerror", (error) => hoverErrors.push(error.message));
      await hovered.goto(app.url + "/shop/a");
      await hovered.waitForLoadState("networkidle");
      assert.equal(await hovered.evaluate(() => !!(document as unknown as { $r?: { r(): unknown } }).$r?.r()), false);
      const warmed = hovered.waitForRequest((request) => /\/u\/1\/x\?.*_rivet=data/.test(request.url()));
      await hovered.hover('nav a[href="/u/1/x"]');
      await warmed;
      assert.ok(await hovered.evaluate(() => !!(document as unknown as { $r?: { r(): unknown } }).$r?.r()), "booted on intent");
      assert.deepEqual(data, ["/u/1/x"], "intent prefetched the route data before any click");
      await hovered.click('nav a[href="/u/1/x"]');
      await hovered.waitForFunction(() => document.querySelector("h1")?.textContent === "User page x");
      assert.deepEqual(data, ["/u/1/x"], "the click reused the prefetched data");
      assert.deepEqual(hoverErrors, []);
      await hovered.close();
    });

    await t.test("SSR error pages keep the root layout (root _layout.server.ts) when its loader succeeded", async () => {
      // Page loader 404 (layouts loaded), unmatched URL (root guard + loader run for the 404 page),
      // nested layout loader failure (root kept, the failed layout dropped).
      for (const [path, status, message] of [["/shop/broken", 404, "No such product"], ["/missing", 404, "Not found"], ["/u/404/x", 500, "Something went wrong"]] as const) {
        const response = await fetch(app.url + path);
        assert.equal(response.status, status, path);
        const html = await response.text();
        assert.match(html, /<div id="shell">/, path);
        assert.match(html, /<p id="root-loads">(<!--r\d*-->)?\d+</, path);
        assert.ok(html.includes(message), path);
        assert.doesNotMatch(html, /id="user"/, path);
      }
      // The resumed error page navigates on inside the same root layout.
      const fresh = await browser.newPage();
      const pageErrors: string[] = [];
      const loads: string[] = [];
      fresh.on("pageerror", (error) => pageErrors.push(error.message));
      fresh.on("request", (request) => request.resourceType() === "document" && loads.push(new URL(request.url()).pathname));
      await fresh.goto(app.url + "/shop/broken");
      await fresh.evaluate(() => ((document.querySelector("#shell") as HTMLElement & { __mark?: number }).__mark = 1));
      await fresh.evaluate(() => document.querySelector<HTMLElement>('nav a[href="/shop/a"]')!.click());
      await fresh.waitForFunction(() => document.querySelector("h1")?.textContent === "Page a");
      assert.ok(await fresh.evaluate(() => (document.querySelector("#shell") as HTMLElement & { __mark?: number }).__mark === 1), "root layout kept");
      assert.deepEqual(pageErrors, []);
      assert.deepEqual(loads, ["/shop/broken"]);
      await fresh.close();
    });
  } finally {
    await browser.close();
    await app.close();
  }
}));
