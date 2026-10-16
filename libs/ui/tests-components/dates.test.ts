// DateField / TimeField — resumed story app (`/dates`): SSR markup (BEM block, data-slots, segment text), HeroUI CSS applied, resumed
// ArrowUp / ArrowDown on a segment + `onChange` (once per key: the DateInputGroup `<Group>` nests the DateInput's own group), typing
// digits builds a full date, AM/PM toggle, keyboard focus-visible on the first segment (Tab; upstream "focus-visible via keyboard");
// DatePicker / DateRangePicker: SSR closed, popover CSS, resumed open + cell select (+ close), Escape after keyboard input returns focus
// to the trigger (upstream focus restore), range start / end.
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

const seg = (root: string, type: string) => `${root} [data-slot=date-input-group-segment][data-type=${type}]`;

test("dates: SSR markup + HeroUI CSS", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/dates");
    assert.match((await page.getAttribute("#df [data-slot=date-field]", "class")) ?? "", /^date-field/);
    assert.match((await page.getAttribute("#df [data-slot=date-input-group]", "class")) ?? "", /date-input-group--primary/);
    assert.equal(await page.textContent(seg("#df", "month")), "8");
    assert.equal(await page.textContent(seg("#df", "day")), "15");
    assert.equal(await page.textContent(seg("#tf", "minute")), "30");
    assert.equal(await page.textContent(seg("#tf", "dayPeriod")), "AM");
    // Vendored CSS: the group is a flex row.
    assert.equal(await page.$eval("#df [data-slot=date-input-group]", (el) => getComputedStyle(el).display), "flex");
    await page.waitForLoadState("networkidle");
    assert.deepEqual(seen.errors, []);
  }));

test("dates: ArrowUp / ArrowDown change the value once per key", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/dates");
    await page.waitForLoadState("networkidle");
    await page.click(seg("#df", "day"));
    await page.keyboard.press("ArrowUp");
    await page.waitForFunction(() => document.querySelector("#df-value")?.textContent === "2026-08-16");
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(() => document.querySelector("#df-value")?.textContent === "2026-08-15");
    assert.equal(await page.textContent(seg("#df", "day")), "15");
    assert.deepEqual(seen.errors, []);
  }));

test("dates: typing digits builds a full date", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/dates");
    await page.waitForLoadState("networkidle");
    await page.click(seg("#df-empty", "month"));
    // Nothing boots before input: the click loads the field's handlers. Keys typed within those few ms replay on
    // their original target (the month segment), so type once the focus handlers ran, as a person would.
    await page.waitForSelector("#df-empty [data-slot=date-input-group][data-focus-within]");
    await page.keyboard.type("01022026");
    await page.waitForFunction(() => document.querySelector("#df-empty-value")?.textContent === "2026-01-02");
  }));

test("dates: TimeField minute + AM/PM", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/dates");
    await page.waitForLoadState("networkidle");
    await page.click(seg("#tf", "minute"));
    await page.keyboard.press("ArrowUp");
    await page.waitForFunction(() => document.querySelector("#tf-value")?.textContent === "9:31");
    await page.click(seg("#tf", "dayPeriod"));
    await page.keyboard.press("ArrowUp");
    await page.waitForFunction(() => document.querySelector("#tf-value")?.textContent === "21:31");
    assert.equal(await page.textContent(seg("#tf", "dayPeriod")), "PM");
  }));

test("dates: keyboard focus shows data-focus-visible", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/dates");
    await page.waitForLoadState("networkidle");
    // Tab past the story app's nav links to the first segment.
    for (let i = 0; i < 8 && !(await page.evaluate(() => document.activeElement?.getAttribute("data-type") === "month")); i++) await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.closest("#df") != null), true);
    await page.waitForFunction(() => document.querySelector("#df [data-focus-visible=true]") != null);
  }));

test("dates: DatePicker SSR closed + resumed cell select", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/dates");
    assert.match((await page.getAttribute("#dp [data-slot=date-picker]", "class")) ?? "", /^date-picker/);
    assert.equal(await page.$("[data-slot=date-picker-popover]"), null);
    await page.waitForLoadState("networkidle");
    await page.click("#dp [data-slot=date-picker-trigger]");
    await page.waitForSelector("[data-slot=date-picker-popover] [role=grid]");
    // Vendored CSS: the popover is an overlay surface with a background.
    assert.notEqual(await page.$eval("[data-slot=date-picker-popover]", (el) => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
    await page.click("[data-slot=date-picker-popover] [data-slot=calendar-cell]:text-is('20')");
    await page.waitForFunction(() => document.querySelector("#dp-value")?.textContent === "2026-08-20");
    await page.waitForFunction(() => document.querySelector("[data-slot=date-picker-popover]") === null);
    assert.equal(await page.textContent(seg("#dp", "day")), "20");
    assert.deepEqual(seen.errors, []);
  }));

test("dates: DatePicker Escape after keyboard input focuses the trigger", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/dates");
    await page.waitForLoadState("networkidle");
    await page.focus("#dp [data-slot=date-picker-trigger]");
    await page.keyboard.press("Enter");
    await page.waitForSelector("[data-slot=date-picker-popover] [role=grid]");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector("[data-slot=date-picker-popover]") === null);
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-slot") === "date-picker-trigger");
  }));

test("dates: DateRangePicker range select", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/dates");
    await page.waitForLoadState("networkidle");
    assert.equal(await page.textContent("#drp [data-slot=date-range-picker-range-separator]"), " - ");
    await page.click("#drp [data-slot=date-range-picker-trigger]");
    await page.waitForSelector("[data-slot=date-range-picker-popover] [role=grid]");
    await page.click("[data-slot=date-range-picker-popover] [data-slot=range-calendar-cell-button]:text-is('10')");
    await page.click("[data-slot=date-range-picker-popover] [data-slot=range-calendar-cell-button]:text-is('12')");
    await page.waitForFunction(() => document.querySelector("#drp-value")?.textContent === "2026-08-10/2026-08-12");
    assert.deepEqual(seen.errors, []);
  }));
