// Sidebar extensions — resumed story app (`/sidebar-extensions`): SSR classes of the tree trigger / default indicator /
// sub panel, chip (HeroUI chip classes), MenuActions, pages (inactive page `display: none`); resumed tree toggle (indicator
// rotation from the vendored CSS), pages switch; 500px viewport: the sheet backdrop carries `data-backdrop="opaque"`.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { BrowserContext, Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page, seen: ReturnType<typeof watch>) => Promise<void>, viewport = { width: 1280, height: 720 }): Promise<void> {
  const context: BrowserContext = await s.browser.newContext({ viewport });
  const page = await context.newPage();
  const seen = watch(page);
  try {
    await page.goto(s.origin + "/sidebar-extensions");
    await page.waitForLoadState("networkidle");
    await body(page, seen);
  } finally {
    await context.close();
  }
}

const cls = (page: Page, selector: string) => page.getAttribute(selector, "class").then((c) => c ?? "");
const rotation = (page: Page) => page.$eval("#sx-ind", (el) => getComputedStyle(el).rotate);

test("sidebar extensions: SSR classes (tree, chip, actions, pages)", () =>
  onPage(async (page, seen) => {
    assert.equal(await page.locator("script[data-boot]").count(), 0);
    assert.match(await cls(page, "#sx-tree"), /\bsidebar__menu-button\b/);
    assert.equal(await page.getAttribute("#sx-tree", "aria-expanded"), "true");
    assert.match(await cls(page, "#sx-ind"), /\bsidebar__menu-indicator\b/);
    assert.equal(await page.locator("#sx-ind svg").count(), 1, "default chevron icon");
    assert.match(await cls(page, '[data-slot="sidebar-menu-sub-panel"]'), /\bsidebar__menu-sub-panel\b/);
    assert.match(await cls(page, "#sx-chip"), /\bchip\b.*\bsidebar__menu-chip\b/);
    assert.match(await cls(page, "#sx-actions"), /\bsidebar__menu-actions\b/);
    assert.equal(await page.getAttribute("#sx-actions", "role"), "group");
    assert.equal(await page.getAttribute("#sx-home", "aria-current"), "page");
    assert.match(await cls(page, '[data-slot="sidebar-pages"]'), /\bsidebar__pages\b/);
    assert.equal(await page.$eval('[data-slot="sidebar-page"][data-value="b"]', (el) => getComputedStyle(el).display), "none");
    assert.notEqual(await rotation(page), "none", "expanded indicator rotated");
    assert.deepEqual(seen.errors, []);
  }));

test("sidebar extensions: resumed tree toggle and pages switch", () =>
  onPage(async (page, seen) => {
    await page.click("#sx-tree");
    await page.waitForFunction(() => document.getElementById("sx-tree")?.getAttribute("aria-expanded") === "false");
    await page.waitForFunction(() => getComputedStyle(document.getElementById("sx-ind")!).rotate === "none", undefined, { timeout: 3000 });
    await page.click("#sx-to-b");
    await page.waitForFunction(() => document.getElementById("sx-page")?.textContent === "b");
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-slot="sidebar-page"][data-value="a"]')!).display === "none", undefined, {
      timeout: 5000,
    });
    await page.click("#sx-to-a");
    await page.waitForFunction(() => document.getElementById("sx-page")?.textContent === "a");
    assert.deepEqual(seen.errors, []);
  }));

test("sidebar extensions: mobile sheet backdrop opaque", () =>
  onPage(
    async (page, seen) => {
      await page.click("#sx-trigger");
      await page.waitForSelector("[role=dialog]");
      const backdrop = page.locator(".sidebar__sheet-backdrop");
      assert.equal(await backdrop.getAttribute("data-backdrop"), "opaque");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector("[role=dialog]"));
      assert.deepEqual(seen.errors, []);
    },
    { width: 500, height: 800 },
  ));
