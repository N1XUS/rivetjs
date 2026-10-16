// Slider — resumed story app (`/slider`): the upstream slider cases that need a real browser (Tab focus + focus-visible, arrow /
// Home / End keys, `onChangeEnd`, range thumbs) and the cdk free drag + Motion1D snap-on-release the ui Slider inherits
// (thumb follows the pointer, value stepped, `data-snapping` while animating, settles on the step; `data-fill-*` on the track).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage();
  try {
    await body(page);
  } finally {
    await page.close();
  }
}

const waitText = (page: Page, sel: string, value: string) =>
  page.waitForFunction(([s, v]) => document.querySelector(s!)?.textContent === v, [sel, value] as const);
const waitAttr = (page: Page, sel: string, name: string, value: string | null) =>
  page.waitForFunction(([s, n, v]) => document.querySelector(s!)?.getAttribute(n!) === v, [sel, name, value] as const);

test("slider: SSR markup = HeroUI classes + data-slots, stepped positions", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/slider");
    assert.equal(await page.getAttribute("[data-testid=vol]", "data-slot"), "slider");
    assert.match((await page.getAttribute("[data-testid=vol]", "class"))!, /\bslider\b/);
    assert.equal(await page.textContent("[data-testid=vol] [data-slot=slider-output]"), "30");
    assert.equal(await page.textContent("[data-testid=range] [data-slot=slider-output]"), "100 – 500");
    assert.equal(await page.getAttribute("[data-testid=vol] [data-slot=slider-track]", "data-fill-start"), "true");
    assert.equal(await page.locator("[data-testid=range] input[type=range]").count(), 2);
    await page.waitForLoadState("networkidle");
    assert.deepEqual(seen.errors, []);
  }));

test("slider (upstream): Tab focuses the thumb (focus-visible); arrows / Home / End change the value; onChangeEnd", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/slider");
    await page.focus("#before");
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => (document.activeElement as HTMLInputElement | null)?.type === "range");
    await waitAttr(page, "[data-testid=vol] [data-slot=slider-thumb]", "data-focus-visible", "true");
    await page.keyboard.press("ArrowRight");
    await waitText(page, "#vol-state", "31");
    await waitText(page, "#vol-end", "31");
    await waitText(page, "[data-testid=vol] [data-slot=slider-output]", "31");
    await page.keyboard.press("End");
    await waitText(page, "#vol-state", "100");
    await waitAttr(page, "[data-testid=vol] [data-slot=slider-track]", "data-fill-end", "true");
    await page.keyboard.press("Home");
    await waitText(page, "#vol-state", "0");
    await waitAttr(page, "[data-testid=vol] [data-slot=slider-track]", "data-fill-start", null);
    assert.deepEqual(seen.errors, []);
  }));

test("slider (upstream range): arrow keys move the focused thumb", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/slider");
    const thumbs = page.locator("[data-testid=range] input[type=range]");
    await thumbs.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    await waitText(page, "#range-state", "150,500");
    await thumbs.nth(1).focus();
    await page.keyboard.press("ArrowLeft");
    await waitText(page, "#range-state", "150,450");
    await waitText(page, "[data-testid=range] [data-slot=slider-output]", "150 – 450");
    assert.deepEqual(seen.errors, []);
  }));

test("slider: stepped thumb drags freely, value stays stepped, Motion1D snap on release (data-snapping)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/slider");
    const thumbSel = "[data-testid=step] [data-slot=slider-thumb]";
    const thumb = (await page.locator(thumbSel).boundingBox())!;
    const track = (await page.locator("[data-testid=step] [data-slot=slider-track]").boundingBox())!;
    const y = thumb.y + thumb.height / 2;
    await page.mouse.move(thumb.x + thumb.width / 2, y);
    await page.mouse.down();
    await page.waitForFunction((sel) => document.querySelector(sel)?.hasAttribute("data-dragging"), thumbSel);
    // The track has 12px transparent inline borders: percentages are of its content box.
    const inner = { x: track.x + 12, width: track.width - 24 };
    await page.mouse.move(inner.x + inner.width * 0.37, y, { steps: 6 });
    await waitText(page, "#step-state", "40");
    const free = await page.locator(thumbSel).evaluate((el) => parseFloat((el as HTMLElement).style.left));
    assert.ok(Math.abs(free - 37) < 2, `free position ${free}% follows the pointer`);
    await page.mouse.up();
    await page.waitForFunction((sel) => document.querySelector(sel)?.hasAttribute("data-snapping"), thumbSel);
    await page.waitForFunction((sel) => (document.querySelector(sel) as HTMLElement).style.left === "40%", thumbSel);
    await page.waitForFunction((sel) => !document.querySelector(sel)!.hasAttribute("data-snapping"), thumbSel);
    assert.equal(await page.textContent("#step-state"), "40");
    assert.equal(await page.getAttribute(thumbSel, "style").then((v) => /transition/.test(v ?? "")), false);
    assert.deepEqual(seen.errors, []);
  }));

test("slider shorthand (T21): label-only range slider renders Output + two thumbs; arrows move each thumb on a resumed page", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/slider");
    const thumbs = page.locator("[data-testid=sh-range] input[type=range]");
    assert.equal(await thumbs.count(), 2);
    await thumbs.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    await waitText(page, "#sh-range-state", "30,60");
    await thumbs.nth(1).focus();
    await page.keyboard.press("ArrowLeft");
    await waitText(page, "#sh-range-state", "30,50");
    await waitText(page, "[data-testid=sh-range] [data-slot=slider-output]", "30 – 50");
    assert.deepEqual(seen.errors, []);
  }));
