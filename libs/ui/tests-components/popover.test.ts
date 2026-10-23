// Popover — resumed story app (`/popover`): SSR markup (closed: trigger only, aria-expanded), upstream popover.browser.test.tsx
// (focus moves into the dialog on open, Escape closes and restores focus to the trigger), HeroUI classes + CSS applied on the
// open popover, placement top + default arrow (rotation per placement from the vendored CSS), `Popover.Trigger` opens with a
// click and with Enter, controlled `isOpen` signal both ways.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

// The folded Contents (no own Popover.Dialog) are found by their heading.
const PDIALOG = "[data-slot=popover-dialog]:has([data-testid=po-ptitle])";
const CDIALOG = "[data-slot=popover-dialog]:has([data-testid=po-ctitle])";

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

const attr = (page: Page, selector: string, name: string) => page.getAttribute(selector, name);

for (const axis of ["x", "y"] as const) {
  test(`popover: fixed trigger closes after real document ${axis} scrolling`, () =>
    onPage(async (page) => {
      const seen = watch(page);
      await page.goto(s.origin + "/popover-fixed");
      await page.evaluate(() => window.scrollTo(80, 90));
      await page.click("#fixed-trigger");
      await page.locator("#fixed-dialog").waitFor();
      assert.equal(await page.locator(".popover").evaluate((el) => getComputedStyle(el).position), "absolute");
      const before = await page.locator("#fixed-trigger").boundingBox();
      const offset = await page.evaluate((axis) => (axis === "x" ? window.scrollX : window.scrollY), axis);
      await page.evaluate((axis) => window.scrollBy(axis === "x" ? 40 : 0, axis === "y" ? 40 : 0), axis);
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      assert.equal(await page.evaluate((axis) => (axis === "x" ? window.scrollX : window.scrollY), axis), offset + 40);
      assert.deepEqual(await page.locator("#fixed-trigger").boundingBox(), before, "the fixed trigger remains at its opening viewport position");
      await page.locator("#fixed-dialog").waitFor({ state: "detached", timeout: 1500 });
      assert.deepEqual(seen.errors, []);
    }));
}

test("popover: SSR closed markup (trigger only)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/popover");
    assert.equal(await attr(page, "#po-trigger", "aria-expanded"), "false");
    assert.equal(await page.$("#po-dialog"), null);
    assert.equal(await attr(page, "#po-ptrigger", "role"), "button");
    assert.equal(await attr(page, "#po-ptrigger", "class"), "popover__trigger");
    await page.waitForLoadState("networkidle");
    assert.deepEqual(seen.errors, []);
  }));

test("popover (upstream browser): focus moves into the dialog; Escape closes and restores focus", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/popover");
    await page.click("#po-trigger");
    await page.waitForSelector("#po-dialog");
    await page.waitForFunction(() => document.querySelector("#po-dialog")!.contains(document.activeElement));
    assert.equal(await attr(page, "#po-trigger", "aria-expanded"), "true");
    assert.equal(await attr(page, "#po-dialog", "data-slot"), "popover-dialog");
    assert.match((await page.$eval("#po-dialog", (el) => el.closest("[data-rv-overlay]")?.className)) ?? "", /^popover max-w-64/);
    // HeroUI CSS: overlay background + radius on .popover, padding on the dialog.
    assert.notEqual(await page.$eval("#po-dialog", (el) => getComputedStyle(el).paddingTop), "0px");
    assert.notEqual(await page.$eval(".popover", (el) => getComputedStyle(el).borderTopLeftRadius), "0px");
    await page.keyboard.press("Escape");
    await page.waitForSelector("#po-dialog", { state: "detached" });
    await page.waitForFunction(() => document.activeElement?.id === "po-trigger");
    assert.deepEqual(seen.errors, []);
  }));

test("popover: placement top + default arrow tip (vendored rotate rules, overlay fill)", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/popover");
    await page.click("#po-top");
    await page.waitForSelector("#po-top-dialog");
    await page.waitForFunction(() => document.querySelector(".popover[data-placement]")?.getAttribute("data-placement") === "top");
    const tip = "[data-slot=popover-overlay-arrow]";
    assert.equal(await page.$eval(tip, (el) => getComputedStyle(el).rotate), "none");
    assert.notEqual(await page.$eval(tip, (el) => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
    // Arrow group sits below the popover box (top placement: arrow at `top: 100%`).
    const [pop, arrow] = await Promise.all([
      page.$eval(".popover", (el) => el.getBoundingClientRect().bottom),
      page.$eval("[data-slot=popover-overlay-arrow-group]", (el) => el.getBoundingClientRect().top),
    ]);
    assert.ok(Math.abs(arrow - pop) < 1.5, `arrow top ${arrow} vs popover bottom ${pop}`);
  }));

test("popover: Popover.Trigger opens on click and on Enter", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/popover");
    await page.click("#po-ptrigger");
    await page.waitForSelector(PDIALOG);
    assert.equal(await attr(page, "#po-ptrigger", "aria-expanded"), "true");
    // Folded Content: one dialog, labelled by its heading.
    assert.equal(await page.$$eval("[data-slot=popover-dialog]", (els) => els.length), 1);
    assert.equal(await attr(page, PDIALOG, "aria-labelledby"), await page.$eval(PDIALOG, (el) => el.querySelector(".popover__heading")!.id));
    // Positioned against the trigger (bottom placement, offset 8): the trigger ref works on the resumed page.
    await page.waitForFunction(
      () => !document.querySelector("[data-slot=popover-dialog]:has([data-testid=po-ptitle])")!.closest(".popover")!.hasAttribute("data-entering"),
    );
    const [triggerBottom, popTop] = await Promise.all([
      page.$eval("#po-ptrigger", (el) => el.getBoundingClientRect().bottom),
      page.$eval(PDIALOG, (el) => el.closest(".popover")!.getBoundingClientRect().top),
    ]);
    assert.ok(Math.abs(popTop - triggerBottom - 8) < 1.5, `popover top ${popTop} vs trigger bottom ${triggerBottom}`);
    await page.keyboard.press("Escape");
    await page.waitForSelector(PDIALOG, { state: "detached" });
    await page.waitForFunction(() => document.activeElement?.id === "po-ptrigger");
    await page.keyboard.press("Enter");
    await page.waitForSelector(PDIALOG);
  }));

test("popover: controlled isOpen signal both ways", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/popover");
    await page.click("#po-ext");
    await page.waitForSelector(CDIALOG);
    assert.equal(await page.textContent("#po-state"), "open");
    await page.keyboard.press("Escape");
    await page.waitForSelector(CDIALOG, { state: "detached" });
    await page.waitForFunction(() => document.querySelector("#po-state")?.textContent === "closed");
    await page.click("#po-ctrl");
    await page.waitForSelector(CDIALOG);
    await page.waitForFunction(() => document.querySelector("#po-state")?.textContent === "open");
  }));
