// Calendar — resumed story app (`/calendar`): SSR markup (BEM block, heading, selected day, year picker closed), HeroUI CSS applied,
// resumed day selection + `onChange`, nav buttons page the month, keyboard focus-visible on the focused cell (Tab), year picker on a
// resumed page (opens over the day grid, selected year focused, Arrow keys + Enter pick a year, Escape closes).
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

const heading = (page: Page, root: string) =>
  page.$eval(`${root} [data-slot=calendar-heading], ${root} [data-slot=calendar-year-picker-trigger-heading]`, (el) => el.textContent);

test("calendar: SSR markup + HeroUI CSS", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/calendar");
    assert.match((await page.getAttribute("#cal", "class")) ?? "", /^calendar/);
    assert.equal(await page.getAttribute("#cal", "data-slot"), "calendar");
    assert.equal(await heading(page, "#cal"), "August 2026");
    assert.equal(await page.getAttribute("#cal-trigger", "aria-expanded"), "false");
    assert.equal(await page.$eval("#cal td[aria-selected=true]", (el) => el.textContent?.trim()), "15");
    assert.equal(await heading(page, "#cal-plain"), "August 2026");
    // Vendored CSS: grid cells are sized, the selected cell has a background.
    assert.notEqual(
      await page.$eval(
        "#cal [data-selected] [data-slot=calendar-cell], #cal [data-slot=calendar-cell][data-selected]",
        (el) => getComputedStyle(el).backgroundColor,
      ),
      "rgba(0, 0, 0, 0)",
    );
    await page.waitForLoadState("networkidle");
    assert.deepEqual(seen.errors, []);
  }));

test("calendar: resumed day selection + onChange, nav buttons page the month", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/calendar");
    await page.waitForLoadState("networkidle");
    await page.click("#cal [data-slot=calendar-cell]:text-is('20')");
    await page.waitForFunction(() => document.querySelector("#cal-value")?.textContent === "2026-08-20");
    assert.equal(await page.$eval("#cal td[aria-selected=true]", (el) => el.textContent?.trim()), "20");
    await page.click("#cal-next");
    await page.waitForFunction(() => document.querySelector("#cal-plain [data-slot=calendar-heading]")?.textContent === "September 2026");
    await page.click("#cal-prev");
    await page.click("#cal-prev");
    await page.waitForFunction(() => document.querySelector("#cal-plain [data-slot=calendar-heading]")?.textContent === "July 2026");
    assert.deepEqual(seen.errors, []);
  }));

test("calendar: keyboard focus on the focused cell shows data-focus-visible", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/calendar");
    await page.waitForLoadState("networkidle");
    await page.focus("#cal-next");
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => document.activeElement?.closest("#cal-plain [data-slot=calendar-grid]") != null);
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "1");
    await page.waitForFunction(() => document.activeElement?.hasAttribute("data-focus-visible"));
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === "2");
  }));

test("calendar: year picker on a resumed page (open, focus selected year, arrows + Enter, Escape)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/calendar");
    await page.waitForLoadState("networkidle");
    await page.click("#cal-trigger");
    await page.waitForFunction(() => document.querySelector("#cal-trigger")?.getAttribute("aria-expanded") === "true");
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-year") === "2026");
    assert.equal(await page.getAttribute("#cal-years [data-year='2026']", "aria-selected"), "true");
    // Grid covers the day grid (positioned by the client effect).
    const grid = await page.$eval("#cal [data-slot=calendar-grid]", (el) => el.getBoundingClientRect().top);
    const years = await page.$eval("#cal-years", (el) => el.getBoundingClientRect().top);
    assert.ok(Math.abs(grid - years) < 2, `years top ${years} vs grid top ${grid}`);
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-year") === "2029");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#cal-trigger")?.getAttribute("aria-expanded") === "false");
    // React Aria useCalendarYearPicker: items run from the clamped max (default 2099-12-31) backwards, so every item is Dec 31 and the
    // focused date moves to December (same in HeroUI).
    assert.equal(await heading(page, "#cal"), "December 2029");
    await page.click("#cal-trigger");
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-year") === "2029");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector("#cal-trigger")?.getAttribute("aria-expanded") === "false");
    assert.deepEqual(seen.errors, []);
  }));

const rcCell = (day: number) => `#rc [data-slot=range-calendar-cell]:has([data-slot=range-calendar-cell-button]:text-is('${day}'))`;

test("range-calendar: SSR range attributes + CSS; resumed range selection, cell button data-*, paging", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/calendar");
    assert.equal(await page.getAttribute("#rc", "class"), "range-calendar");
    assert.equal(await page.getAttribute(rcCell(3), "data-selection-start"), "true");
    assert.equal(await page.getAttribute(rcCell(7), "data-selection-end"), "true");
    assert.equal(await page.getAttribute(`${rcCell(3)} [data-slot=range-calendar-cell-button]`, "data-selected"), "true");
    // Vendored CSS: the in-range cell gets the range background, the start button the accent fill.
    const bg = (sel: string) => page.$eval(sel, (el) => getComputedStyle(el).backgroundColor);
    assert.notEqual(await bg(`${rcCell(3)} [data-slot=range-calendar-cell-button]`), "rgba(0, 0, 0, 0)");
    await page.waitForLoadState("networkidle");
    await page.click(rcCell(10));
    await page.hover(rcCell(14));
    await page.waitForFunction(() => document.querySelector("#rc [data-hovered=true][data-slot=range-calendar-cell-button]") != null);
    await page.click(rcCell(14));
    await page.waitForFunction(() => document.querySelector("#rc-value")?.textContent === "2026-08-10/2026-08-14");
    assert.equal(await page.getAttribute(rcCell(10), "data-selection-start"), "true");
    assert.equal(await page.getAttribute(`${rcCell(14)} [data-slot=range-calendar-cell-button]`, "data-selected"), "true");
    await page.click("#rc-next");
    await page.waitForFunction(() => document.querySelector("#rc [data-slot=range-calendar-heading]")?.textContent === "September 2026");
    assert.deepEqual(seen.errors, []);
  }));
