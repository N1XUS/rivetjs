// Live pages under nested layout levels, end to end (production build of fixture-live-nested, resumed, node
// adapter, Chromium): a search-only navigation of the shown live page (link, back / forward) refreshes its data in
// place — the page keeps its DOM and state, the nested layout keeps its data and follows the URL, one data request,
// no level re-render. Another page in between re-renders it as usual.
import { test } from "vitest";
import { steps } from "@rivetjs/testing/steps";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { build } from "vite";
import { chromium } from "playwright";
import { start } from "../adapters/node.ts";

const root = new URL("./fixture-live-nested/", import.meta.url).pathname;
const configFile = root + "vite.config.ts";

test(
  "live page under nested layouts: search-only navigations refresh it in place",
  steps(async (t) => {
    await rm(root + "dist", { recursive: true, force: true });
    await build({ root, configFile, logLevel: "silent" });
    await build({ root, configFile, logLevel: "silent", build: { ssr: true } });
    const app = await start({ dist: root + "dist", port: 0, onError: () => {} });
    const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
    try {
      await t.test("codegen: the level sync gets the live hook", async () => {
        const generated = await readFile(root + ".rivet/app.tsx", "utf8");
        assert.match(generated, /_sync\(router, nest, NEST, \(from, url\) => _liveLevels\(router, live, nest, NEST, from, url\)\)/);
      });
      const page = await browser.newPage();
      const errors: string[] = [],
        documents: string[] = [],
        data: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (request.resourceType() === "document") documents.push(url.pathname + url.search);
        if (url.searchParams.get("_rivet") === "data") data.push(decodeURIComponent(url.pathname + url.search));
      });
      const counts = async (): Promise<Record<string, number>> => (await fetch(app.url + "/counts")).json() as Promise<Record<string, number>>;
      const text = (selector: string) => page.textContent(selector);
      const until = (selector: string, value: string) =>
        page.waitForFunction(([s, v]) => document.querySelector(s!)?.textContent === v, [selector, value] as const);
      const mark = (selector: string) => page.evaluate((s) => ((document.querySelector(s) as HTMLElement & { __mark?: number }).__mark = 1), selector);
      const marked = (selector: string) =>
        page.evaluate((s) => (document.querySelector(s) as (HTMLElement & { __mark?: number }) | null)?.__mark === 1, selector);

      await page.goto(app.url + "/shop?q=a");
      await page.dispatchEvent("a[href^='/']", "pointerdown");
      await page.waitForFunction(() => (document as unknown as { $r?: { r(): unknown } }).$r?.r());

      await t.test("link to another search: data in place, page and layout kept", async () => {
        await page.click("#clicks");
        await until("#clicks", "Clicked 1");
        await page.fill("#typed", "kept");
        await mark("#page");
        await mark("#shop");
        await page.click("#to-c");
        await until("#q", "c");
        assert.ok(await marked("#page"), "page element kept");
        assert.ok(await marked("#shop"), "layout element kept");
        assert.equal(await text("#clicks"), "Clicked 1");
        assert.equal(await page.inputValue("#typed"), "kept");
        assert.equal(await text("#shop-url"), "/shop?q=c", "layout url() follows");
        assert.equal(await text("#shop-loads"), "1", "layout data kept");
        assert.equal(await text("#page-loads"), "2");
        assert.equal(new URL(page.url()).search, "?q=c");
        assert.deepEqual(data, ["/shop?q=c&_rivet=data&_rivet_keep=/,/shop"]);
        assert.deepEqual(await counts(), { root: 1, shop: 1, page: 2 });
      });

      await t.test("back / forward between searches stay in place", async () => {
        await page.goBack();
        await until("#q", "a");
        assert.equal(await text("#shop-url"), "/shop?q=a");
        await page.goForward();
        await until("#q", "c");
        await page.click("nav a[href='/shop?q=b']");
        await until("#q", "b");
        assert.ok(await marked("#page"));
        assert.equal(await text("#clicks"), "Clicked 1");
        assert.equal(await page.inputValue("#typed"), "kept");
        assert.equal((await counts()).shop, 1);
      });

      await t.test("revalidation of the shown page after a search stays in place", async () => {
        await page.click("#refresh");
        await until("#page-loads", String((await counts()).page));
        assert.ok(await marked("#page"));
        assert.equal(await text("#q"), "b");
      });

      await t.test("another page in between: the live page renders anew", async () => {
        await page.click("nav a[href='/']");
        await until("h1", "Home");
        await page.click("nav a[href='/shop?q=a']");
        await until("#q", "a");
        assert.ok(!(await marked("#page")), "re-rendered");
        assert.equal(await text("#clicks"), "Clicked 0");
        await page.click("#to-c");
        await until("#q", "c");
        assert.equal(await text("#shop-url"), "/shop?q=c");
        assert.deepEqual(documents, ["/shop?q=a"]);
        assert.deepEqual(errors, []);
      });
    } finally {
      await browser.close();
      await app.close();
    }
  }),
);
