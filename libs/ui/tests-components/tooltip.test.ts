// Tooltip — resumed story app (`/tooltip`): upstream tooltip.browser.test.tsx (defaultOpen content, Escape dismisses) and the
// upstream tooltip.test.tsx hover cases on real pointer events (hover renders the BEM block, closeDelay keeps it until the delay,
// isDisabled shows nothing, arrow slot), HeroUI CSS applied, offset 3 / 7 (showArrow) from the trigger, `Tooltip.Trigger`
// opens on hover and keyboard focus.
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

/** Gap between the trigger and its tooltip along the placement axis (top placement: trigger top − tooltip bottom). */
const gap = (page: Page, trigger: string, tooltip: string) =>
  page.evaluate(([t, p]) => document.querySelector(t!)!.getBoundingClientRect().top - document.querySelector(p!)!.getBoundingClientRect().bottom, [
    trigger,
    tooltip,
  ] as const);

test("tooltip (upstream browser): defaultOpen shows content; Escape dismisses", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/tooltip");
    assert.equal(await page.textContent("#tt-open-tip"), "Open tip");
    assert.equal(await page.getAttribute("#tt-open-tip", "role"), "tooltip");
    assert.equal(await page.$("#tt-hover-tip"), null);
    await page.waitForLoadState("networkidle");
    await page.focus("#tt-open");
    await page.keyboard.press("Escape");
    await page.waitForSelector("#tt-open-tip", { state: "detached" });
    assert.deepEqual(seen.errors, []);
  }));

test("tooltip: hover renders the BEM block (HeroUI CSS), offset 3 from the trigger", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/tooltip");
    await page.hover("#tt-hover");
    await page.waitForSelector("#tt-hover-tip");
    assert.match((await page.getAttribute("#tt-hover-tip", "class")) ?? "", /^tooltip/);
    assert.equal(await page.textContent("#tt-hover-tip"), "Hover tip");
    assert.notEqual(await page.$eval("#tt-hover-tip", (el) => getComputedStyle(el).paddingTop), "0px");
    await page.waitForFunction(() => !document.querySelector("#tt-hover-tip")!.hasAttribute("data-entering"));
    assert.ok(Math.abs((await gap(page, "#tt-hover", "#tt-hover-tip")) - 3) < 1.5);
  }));

test("tooltip: closeDelay keeps the tooltip after unhover until the delay", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/tooltip");
    await page.hover("#tt-close");
    await page.waitForSelector("#tt-close-tip");
    await page.mouse.move(5, 5);
    await page.waitForTimeout(100);
    assert.ok(await page.$("#tt-close-tip"), "still open within closeDelay");
    await page.waitForSelector("#tt-close-tip", { state: "detached", timeout: 2000 });
  }));

test("tooltip: isDisabled shows nothing on hover", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/tooltip");
    await page.hover("#tt-disabled");
    await page.waitForTimeout(300);
    assert.equal(await page.$("#tt-disabled-tip"), null);
  }));

test("tooltip: arrow slot when composed, offset 7 with showArrow", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/tooltip");
    await page.hover("#tt-arrow");
    await page.waitForSelector("#tt-arrow-tip [data-slot=tooltip-arrow] [data-slot=overlay-arrow]");
    await page.waitForFunction(() => !document.querySelector("#tt-arrow-tip")!.hasAttribute("data-entering"));
    assert.ok(Math.abs((await gap(page, "#tt-arrow", "#tt-arrow-tip")) - 7) < 1.5);
  }));

test("tooltip: Tooltip.Trigger opens on hover and on keyboard focus", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/tooltip");
    await page.hover("#tt-trigger");
    await page.waitForSelector("#tt-trigger-tip");
    assert.equal(await page.getAttribute("#tt-trigger", "aria-describedby"), "tt-trigger-tip");
    await page.mouse.move(5, 5);
    await page.waitForSelector("#tt-trigger-tip", { state: "detached" });
    await page.focus("#tt-arrow");
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => document.activeElement?.id === "tt-trigger");
    await page.waitForSelector("#tt-trigger-tip");
  }));
