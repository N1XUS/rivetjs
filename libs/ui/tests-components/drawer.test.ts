// Drawer — resumed story app (`/drawer`, `/drawer-open`): SSR markup (closed: trigger only), upstream drawer.browser.test.tsx
// (focus trap, scroll lock, Escape focus restore), HeroUI CSS (bottom sheet pinned to the viewport bottom, left drawer to the
// left), drag to dismiss on the handle (past 30 % → `onOpenChange(false)`), a short slow drag settles back (house motion,
// inline transform cleared), drag from the body does nothing, and drag on a drawer open in the server HTML (resumed page).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { assertFades, stories, traceFade, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 700 } });
  try {
    await body(page);
  } finally {
    await page.close();
  }
}

const scrollLocked = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).overflow === "hidden" || getComputedStyle(document.body).overflow === "hidden");

/** Mouse drag from the centre of `selector` by (dx, dy) in `steps` moves, `delay` ms apart. */
async function drag(page: Page, selector: string, dx: number, dy: number, steps: number, delay: number): Promise<void> {
  const box = (await page.locator(selector).boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps);
    if (delay) await page.waitForTimeout(delay);
  }
  await page.mouse.up();
}

const settled = (page: Page) =>
  page.waitForFunction(() => !document.querySelector("[data-entering]") && document.getAnimations().every((a) => a.playState !== "running"));

const openBottom = async (page: Page) => {
  await page.click("#dr-trigger");
  await page.waitForSelector("#dr-dialog");
  // Let the enter animation finish (upstream CSS `data-entering`).
  await settled(page);
};

test("drawer: SSR closed markup (trigger only)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/drawer");
    assert.equal(await page.$("#dr-dialog"), null);
    assert.equal(await page.getAttribute("#dr-left", "class"), "drawer__trigger");
    assert.equal(await page.getAttribute("#dr-left", "data-slot"), "drawer-trigger");
    await page.waitForLoadState("networkidle");
    assert.deepEqual(seen.errors, []);
  }));

test("drawer (upstream browser): focus trap, scroll lock, Escape focus restore", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/drawer");
    await page.click("#dr-trigger");
    await page.waitForSelector("#dr-dialog");
    await page.waitForFunction(() => document.getElementById("dr-dialog")!.contains(document.activeElement));
    await page.waitForFunction(() => getComputedStyle(document.documentElement).overflow === "hidden" || getComputedStyle(document.body).overflow === "hidden");
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      assert.ok(await page.evaluate(() => document.getElementById("dr-dialog")!.contains(document.activeElement)), `tab ${i} left the dialog`);
    }
    await settled(page);
    // HeroUI CSS: bottom sheet at the bottom edge, full width.
    const box = (await page.locator("#dr-dialog").boundingBox())!;
    assert.ok(Math.abs(box.y + box.height - 700) < 2, `bottom edge ${box.y + box.height}`);
    await page.keyboard.press("Escape");
    await page.waitForSelector("#dr-dialog", { state: "detached" });
    assert.equal(await scrollLocked(page), false);
    await page.waitForFunction(() => document.activeElement?.id === "dr-trigger");
    assert.equal(await page.textContent("#dr-state"), "false");
    assert.deepEqual(seen.errors, []);
  }));

test("drawer: drag the handle down past 30 % dismisses", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/drawer");
    await openBottom(page);
    const height = (await page.locator("#dr-dialog").boundingBox())!.height;
    await drag(page, "#dr-handle", 0, Math.ceil(height * 0.5), 12, 16);
    await page.waitForSelector("#dr-dialog", { state: "detached" });
    assert.equal(await page.textContent("#dr-state"), "false");
    assert.deepEqual(seen.errors, []);
  }));

test("drawer: a short slow drag settles back (inline transform cleared); body drag does nothing", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/drawer");
    await openBottom(page);
    await drag(page, "#dr-handle", 0, 40, 20, 40);
    // Mid-settle the transform is set by the motion loop, then cleared once settled.
    await page.waitForFunction(() => document.getElementById("dr-dialog")!.style.transform === "", undefined, { timeout: 3000 });
    assert.equal(await page.$eval("#dr-dialog", (el) => (el as HTMLElement).style.transition), "");
    assert.ok(await page.$("#dr-dialog"));
    await drag(page, "[data-slot=drawer-body] p", 0, 300, 10, 16);
    await page.waitForTimeout(200);
    assert.ok(await page.$("#dr-dialog"));
    assert.equal(await page.$eval("#dr-dialog", (el) => (el as HTMLElement).style.transform), "");
  }));

test("drawer: left placement (blur backdrop) docks left and drags left to dismiss", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/drawer");
    await page.click("#dr-left");
    await page.waitForSelector("#dr-ldialog");
    await settled(page);
    assert.match((await page.getAttribute("[data-slot=drawer-backdrop]", "class"))!, /drawer__backdrop--blur/);
    const box = (await page.locator("#dr-ldialog").boundingBox())!;
    assert.ok(box.x < 2, `left edge ${box.x}`);
    await drag(page, "#dr-lheader", -Math.ceil(box.width * 0.6), 0, 12, 16);
    await page.waitForSelector("#dr-ldialog", { state: "detached" });
  }));

test("drawer: open in the server HTML — drag works on the resumed page", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/drawer-open");
    assert.ok(await page.$("#dro-dialog"));
    await page.waitForLoadState("networkidle");
    const height = (await page.locator("#dro-dialog").boundingBox())!.height;
    await drag(page, "#dro-handle", 0, Math.ceil(height * 0.6), 12, 16);
    await page.waitForSelector("#dro-dialog", { state: "detached" });
    assert.deepEqual(seen.errors, []);
  }));

// BACKDROP-FIX (2026-10-08): the backdrop's opacity transition (`drawer.css` `[data-entering]` / `[data-exiting]` → 0) runs on
// open and close, the panel slides; the first open of the resumed page and a later browser-created open.
test("drawer: backdrop fades in and out, panel slides (first open + reopen)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/drawer");
    for (const round of ["first open", "reopen"]) {
      const backdrop = await traceFade(page, "[data-slot=drawer-backdrop]");
      const panel = await traceFade(page, "#dr-dialog");
      await page.click("#dr-trigger");
      await page.waitForSelector("#dr-dialog");
      await settled(page);
      await page.waitForTimeout(150);
      const closedAt = await backdrop.now();
      await page.keyboard.press("Escape");
      await page.waitForSelector("[data-slot=drawer-backdrop]", { state: "detached" });
      await page.waitForTimeout(100);
      assertFades(await backdrop.samples(), closedAt, `drawer backdrop (${round})`);
      const slides = await panel.samples();
      assert.ok(
        slides.some((p) => !p.gone && p.t < closedAt && p.running > 0),
        `panel slides in (${round})`,
      );
      assert.ok(
        slides.some((p) => !p.gone && p.t >= closedAt && p.running > 0),
        `panel slides out (${round})`,
      );
      await page.waitForFunction(() => document.activeElement?.id === "dr-trigger");
    }
    assert.deepEqual(seen.errors, []);
  }));
