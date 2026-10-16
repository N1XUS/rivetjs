// Global DOM events and attributes (RAC GlobalDOMAttributes) on Calendar, RangeCalendar, DateField,
// DatePicker and DateRangePicker and their parts, on the resumed story page: forwarded events fire,
// events the components handle themselves still run their behaviour before the user's handler.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const logText = (page: Page) => page.evaluate(() => document.getElementById("de-log")!.textContent!.replace(/\s+/g, " ").trim());
/** Wait until the log has `entries` (in this order) after the entries seen so far. */
async function waitLog(page: Page, entries: string, from = 0) {
  try {
    await page.waitForFunction(
      ([entries, from]) => {
        const log = document
          .getElementById("de-log")!
          .textContent!.trim()
          .split(/\s+/)
          .slice(from as number)
          .join(" ");
        return log.includes(entries as string);
      },
      [entries, from] as const,
      { timeout: 3000 },
    );
  } catch {
    assert.fail(`log missing "${entries}" (from ${from}): "${await logText(page)}"`);
  }
}
const logLength = async (page: Page) => (await logText(page)).split(" ").filter(Boolean).length;
const text = (page: Page, selector: string) => page.evaluate((selector) => document.querySelector(selector)!.textContent!.trim(), selector);

test("calendar / range calendar: root, heading, grid and cell DOM props; grid behaviour chained", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/dom-events-dates");
  assert.equal(await page.getAttribute("#de-cal", "lang"), "en");
  assert.equal(await page.getAttribute("#de-cal", "dir"), "ltr");
  assert.equal(await page.getAttribute("#de-cal .rv-Heading", "lang"), "en");
  assert.equal(await page.getAttribute("#de-cal table", "translate"), "no");
  assert.equal(await page.getAttribute("#de-cal [data-date='2026-10-14']", "lang"), "en");
  assert.equal(await page.getAttribute("#de-range", "dir"), "ltr");

  await page.hover("#de-cal [data-date='2026-10-14']");
  await waitLog(page, "cal-enter");
  await waitLog(page, "cell-enter:2026-10-14");
  await page.mouse.wheel(0, 10);
  await waitLog(page, "cal-wheel");
  await page.dblclick("#de-cal .rv-Heading");
  await waitLog(page, "heading-dbl");
  // Resumed handlers: only the nearest element's handler of a type runs (runtime), so the root's own target.
  await page.dispatchEvent("#de-cal header", "dblclick");
  await waitLog(page, "cal-dbl");
  // Owned pointerdown: the grid selects the cell, then the user's handler runs.
  let n = await logLength(page);
  await page.click("#de-cal [data-date='2026-10-16']");
  await waitLog(page, "grid-down:0", n);
  await page.waitForFunction(() => document.getElementById("de-cal-value")!.textContent === "2026-10-16");
  await page.click("#de-cal [data-date='2026-10-20']", { button: "right" });
  await waitLog(page, "grid-menu", n);

  // RangeCalendar: owned click chained with the range selection; cell dblclick.
  n = await logLength(page);
  await page.click("#de-range [data-date='2026-10-05']");
  await waitLog(page, "range-grid-click", n);
  await page.click("#de-range [data-date='2026-10-08']");
  await page.waitForFunction(() => document.getElementById("de-range-value")!.textContent === "2026-10-05..2026-10-08");
  n = await logLength(page);
  await page.dblclick("#de-range [data-date='2026-10-12']");
  await waitLog(page, "range-cell-dbl:2026-10-12", n);
  await page.dispatchEvent("#de-range header", "dblclick");
  await waitLog(page, "range-dbl", n);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("date field: root, DateInput and segment DOM props; focus within and key events; group press chained", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/dom-events-dates");
  const root = ".rv-DateField:has(#de-df)";
  assert.equal(await page.getAttribute(root, "lang"), "en");
  assert.equal(await page.getAttribute("#de-df", "dir"), "ltr");
  assert.equal(await page.getAttribute("#de-df [data-type=month]", "lang"), "en");
  await page.hover("#de-df [data-type=day]");
  await waitLog(page, "df-enter");
  await waitLog(page, "seg-enter:day");
  await page.click("#de-df [data-type=month]", { button: "right" });
  await waitLog(page, "df-menu");
  // The right click focused the segment (contenteditable): start from outside.
  await page.focus("#de-outside");
  await waitLog(page, "df-blur");

  let n = await logLength(page);
  await page.focus("#de-df [data-type=month]");
  await waitLog(page, "df-focus df-focus-change:true", n);
  await page.keyboard.press("ArrowUp");
  await waitLog(page, "df-key:ArrowUp df-keyup:ArrowUp", n);
  // The segment's text binding may still be loading its chunk (live-props P5: the field's Group is no longer
  // re-created on the first state change, so nothing preloaded it): wait for the text.
  await page.waitForFunction(() => document.querySelector("#de-df [data-type=month]")?.textContent === "3");
  assert.equal(await text(page, "#de-df [data-type=month]"), "3");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(50);
  assert.ok(!(await logText(page)).split(" ").slice(n).includes("df-blur"), "focus moving between segments is not a blur");
  await page.focus("#de-outside");
  await waitLog(page, "df-blur df-focus-change:false", n);

  n = await logLength(page);
  await page.dblclick("#de-df [data-type=year]");
  await waitLog(page, "input-dbl", n);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("date picker / range picker: root, group, button, popover, dialog and segment DOM props; owned events chained", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/dom-events-dates");
  assert.equal(await page.getAttribute(".rv-DatePicker:has(#de-dp)", "lang"), "en");
  assert.equal(await page.getAttribute("#de-dp", "dir"), "ltr");
  assert.equal(await page.getAttribute("#de-dp-button", "lang"), "en");
  assert.equal(await page.getAttribute(".rv-DateRangePicker:has(#de-drp)", "dir"), "ltr");

  await page.hover("#de-dp [data-type=month]");
  await waitLog(page, "group-enter");
  let n = await logLength(page);
  await page.dblclick("#de-dp [data-type=day]");
  await waitLog(page, "dp-seg-dbl:day", n);
  await waitLog(page, "dp-focus dp-focus-change:true", n);
  await page.dispatchEvent(".rv-DatePicker:has(#de-dp) > .rv-Label", "dblclick");
  await waitLog(page, "dp-dbl", n);

  n = await logLength(page);
  await page.keyboard.press("ArrowUp");
  await waitLog(page, "dp-key:ArrowUp dp-keyup:ArrowUp", n);

  // Owned click: the button opens the popover, then the user's handler runs; no blur while open.
  n = await logLength(page);
  await page.hover("#de-dp-button");
  await waitLog(page, "button-enter", n);
  await page.click("#de-dp-button");
  await waitLog(page, "button-click", n);
  await page.waitForSelector("#de-dp-dialog");
  assert.equal(await page.evaluate(() => document.getElementById("de-dp-dialog")!.closest(".rv-Popover")!.getAttribute("lang")), "en");
  assert.equal(await page.getAttribute("#de-dp-dialog", "lang"), "en");
  await page.hover("#de-dp-dialog [role=grid]");
  await page.mouse.wheel(0, 10);
  await waitLog(page, "popover-wheel", n);
  await page.dispatchEvent("#de-dp-dialog", "dblclick");
  await waitLog(page, "dialog-dbl", n);
  await page.keyboard.press("Escape");
  await page.waitForSelector("#de-dp-dialog", { state: "detached" });
  await page.waitForFunction(() => document.activeElement?.id === "de-dp-button");
  const opened = (await logText(page)).split(" ").slice(n);
  assert.ok(!opened.includes("dp-blur"), "no blur while the popover is open: " + opened.join(" "));
  assert.ok(!opened.includes("dp-key:Escape"), "keys inside the popover are not the group's");
  await page.focus("#de-outside");
  await waitLog(page, "dp-blur dp-focus-change:false", n);

  // Owned group pointerup: the group's press logic (touch: focus the last element) runs, then the user's handler.
  // On the group itself: a resumed page runs only the nearest handler, and the field registers pointerup too.
  n = await logLength(page);
  await page.evaluate(() =>
    document.getElementById("de-dp")!.dispatchEvent(new PointerEvent("pointerup", { pointerType: "touch", button: 0, bubbles: true, isPrimary: true })),
  );
  await waitLog(page, "group-up", n);
  // focusLast from the group itself: its last tabbable element.
  await page.waitForFunction(() => document.activeElement?.id === "de-dp-button");

  n = await logLength(page);
  await page.click("#de-drp-start [data-type=month]", { button: "right" });
  await waitLog(page, "drp-menu", n);
  await page.dblclick("#de-drp-end [data-type=day]");
  await waitLog(page, "drp-input-dbl", n);
  await page.dispatchEvent("#de-drp-button", "dblclick");
  await waitLog(page, "drp-button-dbl", n);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("date field / picker with a signal value and JSX label + description: render and resume", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  const response = await page.goto(s.origin + "/dom-events-dates");
  assert.equal(response?.status(), 200);
  assert.equal(await text(page, ".rv-DateField:has(#de-jdf) b"), "JSX field");
  assert.equal(await page.getAttribute(".rv-DateField:has(#de-jdf) ~ [data-testid=hidden-dateinput-container] input", "autocomplete"), "bday");
  await page.focus("#de-jdf [data-type=month]");
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction(() => document.getElementById("de-jdf-out")!.textContent === "2020-03-03");
  await page.focus("#de-jdp [data-type=month]");
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction(() => document.getElementById("de-jdp-out")!.textContent === "2020-03-03");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
