// AppLayout — resumed story app (`/app-layout`): SSR markup; CSS (sticky header, aside width + collapse, responsive:
// aside hidden < 1024 px, menu toggle only < 768 px); resumed aside trigger (onAsideOpenChange, cookie, closed width 0),
// aside shortcut on a real keyboard, sidebar collapse keeps the icon rail, window-splitter keyboard resize of the aside +
// pointer drag of the sidebar.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>, width = 1280): Promise<void> {
  const page = await s.browser.newPage({ viewport: { width, height: 800 } });
  try {
    const seen = watch(page);
    await page.goto(s.origin + "/app-layout");
    await page.waitForLoadState("networkidle");
    await body(page);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
}

const box = (page: Page, sel: string) => page.locator(sel).first().boundingBox();
const settled = (page: Page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
const asideWidth = (page: Page) => page.locator("#al-aside").evaluate((el) => el.getBoundingClientRect().width);

test("app-layout: SSR markup", async () => {
  const page = await s.browser.newPage();
  try {
    const html = await (await page.request.get(s.origin + "/app-layout")).text();
    assert.match(html, /data-app-layout="al"/);
    assert.match(html, /<aside[^>]*id="al-aside"/);
    assert.match(html, /role="separator"/);
  } finally {
    await page.close();
  }
});

test("app-layout: CSS — sticky header, aside column, sidebar width, menu toggle hidden on desktop", () =>
  onPage(async (page) => {
    const header = await box(page, '[data-slot="app-layout-header"]');
    assert.ok(header!.height >= 56);
    const aside = await box(page, "#al-aside");
    assert.ok(Math.abs(aside!.width - 1280 * 0.2) < 3, `aside 20 %: ${aside!.width}`);
    assert.ok(aside!.x + aside!.width >= 1279);
    const gap = await box(page, '[data-slot="sidebar-gap"]');
    assert.ok(Math.abs(gap!.width - 1280 * 0.18) < 3, `sidebar 18 %: ${gap!.width}`);
    assert.equal(await page.locator(".app-layout__menu-toggle").isVisible(), false);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(100);
    const after = await box(page, '[data-slot="app-layout-header"]');
    assert.ok(Math.abs(after!.y) < 1, "header sticks");
  }));

test("app-layout: resumed aside trigger collapses / expands, onAsideOpenChange + cookie; shortcut", () =>
  onPage(async (page) => {
    await page.click('[data-slot="app-layout-aside-trigger"]');
    await page.waitForFunction(() => document.querySelector("#al-log")?.textContent === "c");
    assert.equal(await page.getAttribute("#al-aside", "data-state"), "closed");
    assert.equal(await page.getAttribute('[data-slot="app-layout-aside-trigger"]', "aria-expanded"), "false");
    await settled(page);
    assert.ok((await asideWidth(page)) < 1);
    assert.match(await page.evaluate(() => document.cookie), /aside_state=false/);
    await page.locator("#al-main").click();
    await page.keyboard.press("ControlOrMeta+Shift+KeyE");
    await page.waitForFunction(() => document.querySelector("#al-log")?.textContent === "co");
    assert.equal(await page.getAttribute("#al-aside", "data-state"), "open");
  }));

test("app-layout: sidebar collapses to the icon rail (collapsible icon default)", () =>
  onPage(async (page) => {
    await page.click("#al-sidebar-trigger");
    await page.waitForFunction(() => document.querySelector("[data-app-layout] > [data-slot=sidebar]")?.getAttribute("data-state") === "collapsed");
    await settled(page);
    const gap = await box(page, '[data-slot="sidebar-gap"]');
    assert.equal(Math.round(gap!.width), 48);
  }));

test("app-layout: window-splitter keyboard resize (aside) + pointer drag (sidebar)", () =>
  onPage(async (page) => {
    const handle = page.locator('[data-slot="app-layout-aside-handle"]');
    await handle.focus();
    const before = await asideWidth(page);
    await page.keyboard.press("ArrowLeft");
    await page.waitForFunction((w) => document.querySelector("#al-aside")!.getBoundingClientRect().width > w + 5, before);
    assert.equal(await handle.getAttribute("aria-valuenow"), "21");
    await page.keyboard.press("End");
    await page.waitForFunction(() => Math.abs(document.querySelector("#al-aside")!.getBoundingClientRect().width - 1280 * 0.4) < 3);
    const sh = await box(page, '[data-slot="app-layout-sidebar-handle"]');
    await page.mouse.move(sh!.x + sh!.width / 2, sh!.y + 200);
    await page.mouse.down();
    await page.mouse.move(320, sh!.y + 200, { steps: 4 });
    await page.mouse.up();
    await settled(page);
    const gap = await box(page, '[data-slot="sidebar-gap"]');
    assert.ok(Math.abs(gap!.width - 320) < 4, `dragged to 320: ${gap!.width}`);
    assert.equal(await page.getAttribute('[data-slot="app-layout-sidebar-handle"]', "aria-valuenow"), "25");
  }));

test("app-layout: < 1024 px hides the aside column + trigger, < 768 px shows the menu toggle", async () => {
  await onPage(async (page) => {
    assert.equal(await page.locator("#al-aside").isVisible(), false);
    assert.equal(await page.locator('[data-slot="app-layout-aside-trigger"]').isVisible(), false);
    assert.equal(await page.locator(".app-layout__menu-toggle").isVisible(), false);
  }, 900);
  await onPage(async (page) => {
    assert.equal(await page.locator(".app-layout__menu-toggle").isVisible(), true);
    await page.click(".app-layout__menu-toggle");
    await page.waitForSelector('[data-mobile="true"]');
  }, 600);
});
