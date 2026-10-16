// Tabs — resumed story app (`/tabs`): SSR markup (selected tab + panel only, ListContainer chrome, BEM classes); HeroUI CSS
// (indicator under the selected tab, scroll buttons only when the list overflows); resumed mouse selection (`onSelectionChange`
// key, render-function panel created in the browser, indicator moves to the new tab, disabled tab ignored); keyboard arrows
// (automatic activation, disabled skipped, vertical ArrowDown); overflow scroll buttons scroll the strip; automatic
// indicators (no explicit `Tabs.Indicator`, `#tabs-auto`) follow the selection on the resumed page, vertical too
// (`#tabs-auto-vertical`); an explicit `Tabs.Indicator` mounted later (`#tabs-lazy`) replaces the automatic one.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 900 } });
  try {
    const seen = watch(page);
    await page.goto(s.origin + "/tabs");
    await page.waitForLoadState("networkidle");
    await body(page);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
}

const tab = (root: string, name: string) => `#${root} [role=tab]:text-is("${name}")`;
const selectedText = (page: Page, root: string) => page.locator(`#${root} [role=tab][aria-selected=true]`).textContent();
// Time-based animations only (the scroll shadow's scroll-driven animations always run).
const settled = (page: Page) =>
  page.waitForFunction(() => document.getAnimations().every((a) => a.timeline !== document.timeline || a.playState !== "running"));
const box = (page: Page, sel: string) => page.locator(sel).evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);

test("tabs: SSR markup", async () => {
  const page = await s.browser.newPage();
  try {
    const html = await (await page.request.get(s.origin + "/tabs")).text();
    assert.match(html, /data-slot="tabs"/);
    assert.match(html, /class="tabs__list-container"/);
    assert.match(html, /tabs__list-container__scroller/);
    assert.match(html, /aria-label="Scroll tabs left"/);
    assert.match(html, /class="tabs tabs--secondary|tabs--secondary/);
    assert.match(html, /View your project overview/);
    assert.doesNotMatch(html, /Track your metrics/);
    assert.match(html, /data-slot="tabs-separator"/);
  } finally {
    await page.close();
  }
});

test("tabs: HeroUI CSS (indicator under the selected tab, scroll buttons only on overflow)", () =>
  onPage(async (page) => {
    const t = await box(page, tab("tabs", "Overview"));
    const ind = await box(page, `#tabs [role=tab][aria-selected=true] [data-slot=tabs-indicator]`);
    assert.ok(ind.width > 10 && Math.abs(ind.left - t.left) < 4, "indicator spans the selected tab");
    const visible = (sel: string) =>
      page
        .locator(sel)
        .evaluate((el) => getComputedStyle(el).opacity !== "0" && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden");
    assert.equal(await visible("#tabs .tabs__list-container__scroll-next"), false, "no overflow: no scroll button");
    assert.equal(await visible("#tabs-overflow .tabs__list-container__scroll-next"), true, "overflow: next button shown");
    // The scroller hides its native scrollbar (hideScrollBar).
    const sc = await page.locator("#tabs-overflow .tabs__list-container__scroller").evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    assert.ok(sc.sw > sc.cw);
  }));

test("tabs: resumed mouse selection (key, browser-created panel, indicator moves, disabled ignored)", () =>
  onPage(async (page) => {
    await page.click(tab("tabs", "Analytics"));
    await page.waitForFunction(() => document.querySelector("#tabs-key")?.textContent === "analytics");
    await page.waitForSelector("#tabs [role=tabpanel]:has-text('Track your metrics')");
    assert.equal(await selectedText(page, "tabs"), "Analytics");
    await settled(page);
    const t = await box(page, tab("tabs", "Analytics"));
    const ind = await box(page, `#tabs [role=tab][aria-selected=true] [data-slot=tabs-indicator]`);
    assert.ok(Math.abs(ind.left - t.left) < 4, "indicator moved to Analytics");
    assert.equal(await page.locator("#tabs [data-slot=tabs-indicator]").count(), 1);
    await page.click(tab("tabs", "Reports"), { force: true });
    await page.waitForTimeout(100);
    assert.equal(await selectedText(page, "tabs"), "Analytics");
    // Back to the server-rendered panel.
    await page.click(tab("tabs", "Overview"));
    await page.waitForSelector("#tabs [role=tabpanel]:has-text('View your project overview')");
  }));

test("tabs: resumed automatic indicators (no explicit Tabs.Indicator) move with the selection", () =>
  onPage(async (page) => {
    const indicators = () => page.locator("#tabs-auto [data-slot=tabs-indicator]");
    assert.equal(await indicators().count(), 1);
    for (const name of ["Notifications", "Appearance", "Profile"]) {
      await page.click(tab("tabs-auto", name));
      await page.waitForFunction((n) => document.querySelector("#tabs-auto [role=tabpanel]")?.textContent === n + " panel", name);
      await settled(page);
      assert.equal(await indicators().count(), 1, name + ": one indicator");
      assert.equal(await page.locator("#tabs-auto [role=tab][aria-selected=true] [data-slot=tabs-indicator]").count(), 1, name + ": inside the selected tab");
      const t = await box(page, tab("tabs-auto", name));
      const ind = await box(page, "#tabs-auto [data-slot=tabs-indicator]");
      assert.ok(Math.abs(ind.left - t.left) < 4 && Math.abs(ind.width - t.width) < 4, name + ": indicator spans the tab");
    }
  }));

test("tabs: resumed automatic indicators, vertical orientation", () =>
  onPage(async (page) => {
    const indicators = () => page.locator("#tabs-auto-vertical [data-slot=tabs-indicator]");
    assert.equal(await indicators().count(), 1);
    for (const name of ["Security", "Billing", "General"]) {
      await page.click(tab("tabs-auto-vertical", name));
      await page.waitForFunction((n) => document.querySelector("#tabs-auto-vertical [role=tabpanel]")?.textContent === n + " panel", name);
      await settled(page);
      assert.equal(await indicators().count(), 1, name + ": one indicator");
      const t = await box(page, tab("tabs-auto-vertical", name));
      const ind = await box(page, "#tabs-auto-vertical [data-slot=tabs-indicator]");
      assert.ok(Math.abs(ind.top - t.top) < 4 && Math.abs(ind.height - t.height) < 4, name + ": indicator spans the tab (vertical)");
    }
  }));

test("tabs: an explicit Tabs.Indicator mounted later replaces the automatic one", () =>
  onPage(async (page) => {
    const indicators = () => page.locator("#tabs-lazy [data-slot=tabs-indicator]");
    assert.equal(await indicators().count(), 1, "automatic before");
    await page.click("#tabs-lazy-toggle");
    await settled(page);
    assert.equal(await indicators().count(), 1, "one indicator after the explicit one mounts");
    await page.click(tab("tabs-lazy", "Second"));
    await page.waitForFunction(() => document.querySelector("#tabs-lazy [role=tabpanel]")?.textContent === "Second panel");
    await settled(page);
    assert.equal(await indicators().count(), 1, "one indicator after the selection moves");
    assert.equal(await page.locator("#tabs-lazy [role=tab][aria-selected=true] [data-slot=tabs-indicator]").count(), 1);
  }));

test("tabs: keyboard arrows (automatic activation, disabled skipped, vertical)", () =>
  onPage(async (page) => {
    await page.locator(tab("tabs", "Overview")).focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.querySelector("#tabs-key")?.textContent === "analytics");
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === "Overview");
    assert.equal(await selectedText(page, "tabs"), "Overview");
    await page.locator(tab("tabs-vertical", "Account")).focus();
    await page.keyboard.press("ArrowDown");
    await page.waitForSelector("#tabs-vertical [role=tabpanel]:has-text('Security settings')");
    assert.equal(await selectedText(page, "tabs-vertical"), "Security");
  }));

test("tabs: overflow scroll buttons scroll the strip", () =>
  onPage(async (page) => {
    const scroller = "#tabs-overflow .tabs__list-container__scroller";
    assert.equal(await page.locator(scroller).evaluate((el) => el.scrollLeft), 0);
    await page.click("#tabs-overflow .tabs__list-container__scroll-next");
    await page.waitForFunction((sel) => document.querySelector(sel)!.scrollLeft > 50, scroller);
    await settled(page);
    await page.waitForTimeout(400);
    await page.click("#tabs-overflow .tabs__list-container__scroll-prev");
    await page.waitForFunction((sel) => document.querySelector(sel)!.scrollLeft === 0, scroller);
  }));
