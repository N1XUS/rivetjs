// Rivet Sidebar extensions on the built story app (production build, resumed page, Chromium): `/sidebar-extensions`.
// Cold page boots nothing; tree item toggle (Disclosure), client router via provider `navigate` + `isCurrent`
// accessors, `forceReload`, pages switch, custom `toggleShortcut`, mobile `closeMobileOnAction` (default + group false).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { BrowserContext } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const open = async (viewport = { width: 1280, height: 720 }) => {
  const context: BrowserContext = await s.browser.newContext({ viewport });
  const page = await context.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/sidebar-extensions");
  await page.waitForLoadState("networkidle");
  return { page, seen, context };
};

test("SSR: tree item, guide lines, current links, forceReload, pages", async () => {
  const { page, seen, context } = await open();
  assert.equal(await page.locator("script[data-boot]").count(), 0, "nothing boots at load");
  assert.equal(await page.getAttribute("#x-projects", "aria-expanded"), "true");
  assert.equal(await page.getAttribute("#x-indicator", "aria-hidden"), "true");
  assert.equal(await page.locator('[data-slot="sidebar-menu"][data-guide-lines="hover"]').count(), 1);
  assert.equal(await page.getAttribute("#x-home", "aria-current"), null);
  assert.equal(await page.getAttribute("#x-legacy", "data-rivet-reload"), "");
  assert.equal(await page.getAttribute('[data-slot="sidebar-page"][data-value="main"]', "data-active"), "true");
  assert.equal(await page.locator('[data-slot="sidebar-page"][data-value="settings"]').isHidden(), true);
  assert.deepEqual(seen.errors, []);
  await context.close();
});

test("resumed: the tree trigger collapses and expands its sub menu", async () => {
  const { page, seen, context } = await open();
  await page.click("#x-projects");
  await page.waitForFunction(() => document.getElementById("x-projects")?.getAttribute("aria-expanded") === "false");
  await page.waitForFunction(() => document.getElementById("x-expanded")?.textContent === "c");
  await page.click("#x-projects");
  await page.waitForFunction(() => document.getElementById("x-projects")?.getAttribute("aria-expanded") === "true");
  assert.equal(await page.textContent("#x-expanded"), "co");
  assert.deepEqual(seen.errors, []);
  await context.close();
});

test("resumed: provider navigate routes links in-document; isCurrent follows", async () => {
  const { page, seen, context } = await open();
  await page.click("#x-atlas");
  await page.waitForFunction(() => document.getElementById("x-path")?.textContent === "/atlas");
  assert.equal(new URL(page.url()).pathname, "/sidebar-extensions", "no document navigation");
  await page.waitForFunction(() => document.getElementById("x-atlas")?.getAttribute("aria-current") === "page");
  await page.click("#x-home");
  await page.waitForFunction(() => document.getElementById("x-home")?.getAttribute("aria-current") === "page");
  assert.equal(await page.getAttribute("#x-atlas", "aria-current"), null);
  assert.deepEqual(seen.errors, []);
  await context.close();
});

test("resumed: pages drill in and back", async () => {
  const { page, seen, context } = await open();
  await page.click("#x-to-settings");
  await page.waitForFunction(() => document.getElementById("x-page")?.textContent === "settings");
  await page.waitForFunction(() => document.querySelector('[data-slot="sidebar-page"][data-value="main"]')?.hasAttribute("hidden") === true, undefined, {
    timeout: 5000,
  });
  await page.click("#x-back");
  await page.waitForFunction(() => document.getElementById("x-page")?.textContent === "main");
  assert.deepEqual(seen.errors, []);
  await context.close();
});

test("cold custom toggleShortcut (Alt+S) with focus inside the wrapper", async () => {
  const { page, seen, context } = await open();
  await page.focus("#x-home");
  await page.keyboard.press("Alt+s");
  await page.waitForFunction(() => document.getElementById("panel")?.closest('[data-slot="sidebar"]')?.getAttribute("data-state") === "collapsed");
  // Cmd/Ctrl+B no longer toggles.
  await page.keyboard.press("Control+b");
  await page.waitForTimeout(150);
  assert.equal(await page.locator('[data-slot="sidebar"]').first().getAttribute("data-state"), "collapsed");
  assert.deepEqual(seen.errors, []);
  await context.close();
});

test("mobile: a menu press closes the sheet; a closeMobileOnAction={false} group keeps it open", async () => {
  const { page, seen, context } = await open({ width: 500, height: 800 });
  await page.click("#x-trigger");
  await page.waitForSelector("[role=dialog]");
  await page.click("[role=dialog] #x-to-settings");
  await page.waitForFunction(() => document.getElementById("x-page")?.textContent === "settings");
  await page.waitForTimeout(150);
  assert.equal(await page.locator("[role=dialog]").count(), 1, "group closeMobileOnAction=false keeps the sheet");
  await page.click("[role=dialog] #x-home");
  await page.waitForFunction(() => !document.querySelector("[role=dialog]"), undefined, { timeout: 5000 });
  assert.equal(await page.textContent("#x-path"), "/home");
  assert.deepEqual(seen.errors, []);
  await context.close();
});
