// Sidebar (shadcn/ui 4.21.4 port) on the built story app (production build, resumed page, Chromium): `/sidebar`.
// SSR markup + the `sidebar_state` cookie read by the route loader (`defaultOpen`), resumed toggles (trigger,
// rail, Cmd/Ctrl+B), the cookie written on toggle and read back on reload, collapsed-only tooltips, a
// Disclosure group, the mobile sheet (viewport < 768px).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { BrowserContext, Page } from "playwright";
import { among, codeOf, stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const open = async (options: { cookie?: string; viewport?: { width: number; height: number } } = {}) => {
  const context: BrowserContext = await s.browser.newContext({ viewport: options.viewport ?? { width: 1280, height: 720 } });
  if (options.cookie !== undefined) await context.addCookies([{ name: "sidebar_state", value: options.cookie, url: s.origin }]);
  const page = await context.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/sidebar");
  return { page, seen, context };
};
const state = (page: Page) => page.locator('[data-slot="sidebar"]').first().getAttribute("data-state");
const waitState = (page: Page, value: string) =>
  page.waitForFunction((value) => document.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state") === value, value);
const cookie = async (context: BrowserContext) => (await context.cookies()).find((c) => c.name === "sidebar_state")?.value;

test("cold page: nothing boots the runtime at load (deferred isMobile / shortcut, closed tooltips)", async () => {
  const { page, context } = await open();
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator("script[data-boot]").count(), 0);
  await context.close();
});

// The wrapper's `preload="visible"` directive: its handler's chunks + the chunks of every binding reading the sidebar
// state (Sidebar, the app's onOpenChange / onPress chunk) are fetched when visible — nothing runs. Before it, a slow
// network's first menu click waited ~1.1 s for 25 chunks (story app, 150 ms RTT, 4x CPU).
test("cold page: the first menu click needs no further chunk (preloaded when visible)", async () => {
  const { page, seen, context } = await open();
  await page.waitForLoadState("networkidle");
  const before = seen.scripts.length;
  await page.click("#inbox");
  await page.waitForFunction(() => document.getElementById("pressed")?.textContent === "1");
  assert.deepEqual(
    // Sidebar / Button symbol chunks + the shared code only they import (build manifest; route chunks by default).
    among(seen.scripts.slice(before), codeOf(/#(Sidebar\w*|Button)\$|^@rivetjs\/cdk\/sidebar\//)),
    [],
    "sidebar chunks loaded by the first click",
  );
  assert.deepEqual(seen.errors, []);
  await context.close();
});

test("cold Ctrl+B with focus inside the wrapper toggles (delegated keydown), once", async () => {
  const { page, seen, context } = await open();
  await page.waitForLoadState("networkidle");
  await page.focus("#home");
  await page.keyboard.press("Control+b");
  await waitState(page, "collapsed");
  await page.waitForFunction(() => document.getElementById("log")?.textContent === "c");
  await page.waitForTimeout(100);
  assert.equal(await page.textContent("#log"), "c");
  assert.deepEqual(seen.errors, []);
  await context.close();
});

test("SSR markup: expanded by default, wrapper variables, no component runs", async () => {
  const { page, seen, context } = await open();
  assert.equal(await state(page), "expanded");
  assert.equal(await page.locator('[data-slot="sidebar"]').getAttribute("data-collapsible"), "");
  const wrapper = page.locator("#wrapper");
  assert.equal(await wrapper.getAttribute("data-slot"), "sidebar-wrapper");
  assert.match((await wrapper.getAttribute("style")) ?? "", /--sidebar-width:\s*16rem/);
  assert.equal(await page.locator("#home").getAttribute("data-active"), "true");
  assert.equal(await page.locator("#panel").getAttribute("data-slot"), "sidebar-container");
  assert.equal(await page.evaluate(() => (window as { __componentRuns?: unknown }).__componentRuns), undefined);
  assert.deepEqual(seen.errors, []);
  await context.close();
});

test("the sidebar_state cookie picks the server-rendered state", async () => {
  const { page, context } = await open({ cookie: "false" });
  assert.equal(await state(page), "collapsed");
  assert.equal(await page.locator('[data-slot="sidebar"]').getAttribute("data-collapsible"), "icon");
  await context.close();
});

test("resumed: the trigger toggles, writes the cookie, reload keeps the state", async () => {
  const { page, seen, context } = await open();
  await page.click("#trigger");
  await waitState(page, "collapsed");
  await page.waitForFunction(() => document.getElementById("log")?.textContent === "c");
  assert.equal(await cookie(context), "false");
  await page.reload();
  assert.equal(await state(page), "collapsed");
  await page.click("#trigger");
  await waitState(page, "expanded");
  assert.equal(await cookie(context), "true");
  assert.deepEqual(seen.errors, []);
  await context.close();
});

test("resumed: window-wide shortcut once the runtime runs (focus on body), rail click", async () => {
  const { page, seen, context } = await open();
  await page.waitForLoadState("networkidle");
  // Boot through the trigger, then press with focus on <body> (the window listener, attached at start).
  await page.click("#trigger");
  await waitState(page, "collapsed");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Meta+b");
  await waitState(page, "expanded");
  await page.keyboard.press("Control+b");
  await waitState(page, "collapsed");
  await page.locator("#rail").dispatchEvent("click");
  await waitState(page, "expanded");
  assert.equal(await page.textContent("#log"), "coco");
  assert.deepEqual(seen.errors, []);
  await context.close();
});

test("resumed: menu tooltips only while collapsed", async () => {
  const { page, context } = await open();
  await page.mouse.move(2, 2);
  await page.hover("#inbox");
  await page.waitForTimeout(300);
  assert.equal(await page.locator("[role=tooltip]").count(), 0);
  await page.click("#trigger");
  await waitState(page, "collapsed");
  await page.mouse.move(2, 2);
  await page.hover("#inbox");
  await page.waitForSelector("[role=tooltip]");
  assert.equal(await page.locator("[role=tooltip]").textContent(), "Inbox");
  await page.click("#inbox");
  await page.waitForFunction(() => document.getElementById("pressed")?.textContent === "1");
  await context.close();
});

test("resumed: a Disclosure group label toggles its panel", async () => {
  const { page, context } = await open();
  assert.equal(await page.locator("#help").getAttribute("aria-expanded"), "true");
  await page.click("#help");
  await page.waitForFunction(() => document.getElementById("help")?.getAttribute("aria-expanded") === "false");
  await context.close();
});

test("mobile: below 768px the trigger opens a modal sheet; Escape closes it", async () => {
  const { page, seen, context } = await open({ viewport: { width: 500, height: 800 } });
  await page.waitForLoadState("networkidle");
  // Cold page: the desktop panel stays in the markup, hidden by CSS below 768 px (no viewport check at load).
  assert.equal(await page.locator("#panel").isVisible(), false);
  await page.click("#trigger");
  await page.waitForSelector("[role=dialog]");
  const sheet = page.locator('[data-mobile="true"]');
  assert.equal(await sheet.getAttribute("data-slot"), "sidebar");
  assert.equal((await page.locator("[role=dialog]").getAttribute("aria-labelledby")) !== null, true);
  // Desktop state untouched.
  assert.equal(await state(page), "expanded");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("[role=dialog]"));
  assert.deepEqual(seen.errors, []);
  await context.close();
});

test("collapsed to icons: a size=lg menu button shrinks to 32px like the default ones (upstream size-8!)", async () => {
  const { page, context } = await open({ cookie: "false" });
  await page.waitForLoadState("networkidle");
  const box = (id: string) => page.$eval(id, (el) => [el.getBoundingClientRect().width, el.getBoundingClientRect().height]);
  assert.deepEqual(await box("#home"), [32, 32]);
  assert.deepEqual(await box("#user"), [32, 32]);
  await context.close();
});

test("mobile sheet: Tab from a MenuTrigger button wraps inside the sheet (FocusScope keeps the key)", async () => {
  const { page, seen, context } = await open({ viewport: { width: 500, height: 800 } });
  await page.waitForLoadState("networkidle");
  await page.click("#trigger");
  await page.waitForSelector("[role=dialog]");
  await page.waitForTimeout(400);
  await page.focus("[role=dialog] #user");
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]")), true, `Tab ${i + 1} stays in the sheet`);
  }
  await page.focus("[role=dialog] #user");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]")), true);
  // Enter still opens the menu (the trigger keeps the keys it handles).
  await page.focus("[role=dialog] #user");
  await page.keyboard.press("Enter");
  await page.waitForSelector("#user-menu");
  assert.deepEqual(seen.errors, []);
  await context.close();
});

// Swipe-to-dismiss of the mobile sheet (`sheet-motion.ts`, `@rivetjs/cdk/motion` physics), real Chromium mouse.
const openSheet = async () => {
  const opened = await open({ viewport: { width: 500, height: 800 } });
  await opened.page.waitForLoadState("networkidle");
  await opened.page.click("#trigger");
  await opened.page.waitForSelector("[role=dialog]");
  // Let the enter transition finish.
  await opened.page.waitForTimeout(400);
  const box = (await opened.page.locator('[data-mobile="true"]').boundingBox())!;
  return { ...opened, box };
};
const sheetTransform = (page: Page) => page.$eval('[data-mobile="true"]', (el) => (el as HTMLElement).style.transform);

test("mobile sheet: the drag follows the pointer; a fast flick to the closed edge dismisses it", async () => {
  const { page, seen, context, box } = await openSheet();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 20, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 40, y, { steps: 2 });
  await page.waitForTimeout(50);
  const during = await sheetTransform(page);
  assert.match(during, /^translateX\(-\d+(\.\d+)?px\)$/);
  await page.mouse.move(box.x + box.width - 100, y, { steps: 3 });
  const released = Date.now();
  await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector("[role=dialog]"), undefined, { timeout: 5000 });
  // Closes once off-screen (not after the spring tail settles) and skips the exit replay: the underlay stops
  // blocking the page right away.
  assert.ok(Date.now() - released < 700, `dismissed after ${Date.now() - released} ms`);
  assert.deepEqual(seen.errors, []);
  await context.close();
});

test("mobile sheet: a flick that starts on a link dismisses (no native link drag) and does not follow the link", async () => {
  const { page, seen, context, box } = await openSheet();
  const home = (await page.locator('[data-mobile="true"] #home').boundingBox())!;
  const y = home.y + home.height / 2;
  await page.mouse.move(box.x + box.width - 20, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 40, y, { steps: 2 });
  await page.waitForTimeout(50);
  await page.mouse.move(box.x + box.width - 100, y, { steps: 3 });
  await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector("[role=dialog]"), undefined, { timeout: 2000 });
  assert.equal(new URL(page.url()).hash, "");
  assert.deepEqual(seen.errors, []);
  await context.close();
});

test("mobile sheet: a slow short drag settles back open (Motion1D), inline styles cleared", async () => {
  const { page, context, box } = await openSheet();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 20, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 80, y, { steps: 6 });
  // Older than the tracker's 170 ms window: no flick force.
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForFunction(() => (document.querySelector('[data-mobile="true"]') as HTMLElement | null)?.style.transform === "", undefined, {
    timeout: 5000,
  });
  assert.ok(await page.$("[role=dialog]"));
  await context.close();
});

test("mobile sheet: a slow drag past half the width dismisses; a drag never presses the item under the pointer", async () => {
  const { page, context, box } = await openSheet();
  const inbox = (await page.locator('[data-mobile="true"] #inbox').boundingBox())!;
  const y = inbox.y + inbox.height / 2;
  await page.mouse.move(inbox.x + inbox.width - 10, y);
  await page.mouse.down();
  await page.mouse.move(inbox.x + inbox.width - 10 - box.width * 0.7, y, { steps: 10 });
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector("[role=dialog]"), undefined, { timeout: 5000 });
  assert.equal(await page.textContent("#pressed"), "0");
  await context.close();
});

test("mobile sheet: a vertical move is not a drag", async () => {
  const { page, context, box } = await openSheet();
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(x - 4, box.y + 300, { steps: 5 });
  assert.equal(await sheetTransform(page), "");
  await page.mouse.up();
  assert.ok(await page.$("[role=dialog]"));
  await context.close();
});
