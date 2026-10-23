// Calendar / RangeCalendar in Chromium (resumed story page `/calendar`). Interaction cases ported
// from react-aria-components test/Calendar.test.js + RangeCalendar.test.tsx (Apache-2.0, © Adobe):
// keyboard selection, repeat arrows, unavailable dates by keyboard, multiple selection, range
// press / drag / keyboard, Escape; plus Rivet checks (visible preload may fetch, nothing boots / runs before
// interaction, cold keys held, page changes keep focus).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { scriptsOf, stories, watch, type Stories, type Watch, hinted } from "./harness.ts";

let s: Stories;
// Fetch-ahead on (`data-fo`): the "preloaded when visible" / cold-key checks expect the page's chunks fetched after load.
beforeAll(async () => (s = await stories({ preload: {} })));
afterAll(async () => s?.close());

const cell = (root: string, date: string) => `#${root} [data-date="${date}"]:not([data-outside-month])`;
const activeDate = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute("data-date") ?? document.activeElement?.tagName ?? "");
const waitActive = (page: Page, date: string) => page.waitForFunction((d) => document.activeElement?.getAttribute("data-date") === d, date, { timeout: 5000 });
// Calendar symbol chunks (build manifest: `resume-Calendar…` with component chunks, the route's chunk by default).
const dateScripts = (seen: Watch) => scriptsOf(seen.scripts, /^@rivetjs\/cdk\/calendar\/|#Calendar\w*$/);

test("calendar: server ARIA, visible preload only (nothing boots, no handler runs) before interaction, cold arrow key held", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/calendar");
  assert.equal(await page.getAttribute("#cal", "role"), "application");
  assert.equal(await page.getAttribute("#cal", "aria-label"), "Event date, October 2026");
  assert.equal(await page.getAttribute("#cal table[role=grid]", "role"), "grid");
  assert.equal(await page.getAttribute("#cal table[role=grid]", "aria-label"), "Event date, October 2026");
  assert.equal(await page.textContent("#cal .rv-Heading"), "October 2026");
  assert.equal(await page.getAttribute(cell("cal", "2026-10-14"), "aria-label"), "Wednesday, October 14, 2026 selected");
  assert.equal(await page.getAttribute(cell("cal", "2026-10-14"), "tabindex"), "0");
  assert.equal(await page.getAttribute(cell("cal", "2026-10-15"), "tabindex"), "-1");
  assert.equal(await page.getAttribute(cell("cal", "2026-10-14"), "data-selected"), "true");
  assert.equal(await page.locator(cell("cal", "2026-10-14")).evaluate((el) => el.parentElement!.getAttribute("aria-selected")), "true");
  // Outside-month cells are disabled and not tab stops.
  assert.equal(await page.getAttribute('#cal [data-date="2026-09-27"]', "data-outside-month"), "true");
  assert.equal(await page.getAttribute('#cal [data-date="2026-09-27"]', "tabindex"), null);
  assert.deepEqual(await page.locator("#cal table[role=grid] thead th").allTextContents(), ["S", "M", "T", "W", "T", "F", "S"]);
  assert.deepEqual(
    await page.locator("#cal-de table[role=grid] thead th").allTextContents(),
    ["M", "D", "M", "D", "F", "S", "S"],
    "de-DE weeks start on Monday",
  );
  // The runtime's visible preload may fetch handler chunks (Button hover handlers plan `visible`); nothing boots and no
  // handler runs before the first input. Settle the preload first, so the checks do not race its fetches.
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator("script[data-boot]").count(), 0, "nothing boots at load");
  const hints = await hinted(page);
  const symbols = dateScripts(seen);
  assert.deepEqual(
    symbols.filter((url) => !hints.has(url.replace(/\.deps\.js$/, ".js"))),
    [],
    "calendar symbol chunks before input come from the page's own preload / fetch-ahead hints only",
  );
  assert.equal(await page.locator("#cal [data-focused], #cal [data-hovered], #cal [data-pressed]").count(), 0, "no calendar handler ran");
  assert.equal(await page.getAttribute(cell("cal", "2026-10-14"), "tabindex"), "0");
  await page.focus(cell("cal", "2026-10-14"));
  const before = await page.evaluate(() => scrollY);
  await page.keyboard.press("ArrowDown");
  await waitActive(page, "2026-10-21");
  assert.equal(await page.evaluate(() => scrollY), before, "cold ArrowDown did not scroll");
  assert.equal(await page.getAttribute(cell("cal", "2026-10-21"), "tabindex"), "0");
  assert.equal(await page.getAttribute(cell("cal", "2026-10-14"), "tabindex"), "-1");
  assert.equal(await page.getAttribute(cell("cal", "2026-10-21"), "data-focused"), "true");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("calendar: keyboard navigation, selection, paging keeps focus", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/calendar");
  await page.focus(cell("cal", "2026-10-14"));
  await page.keyboard.press("ArrowRight");
  await waitActive(page, "2026-10-15");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await waitActive(page, "2026-10-13");
  await page.keyboard.press("ArrowUp");
  await waitActive(page, "2026-10-06");
  // Home / End: start / end of the visible month (React Aria focusSectionStart / End).
  await page.keyboard.press("Home");
  await waitActive(page, "2026-10-01");
  await page.keyboard.press("End");
  await waitActive(page, "2026-10-31");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await waitActive(page, "2026-10-09");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#cal-value")?.textContent === "Value: 2026-10-10");
  // The cells' bindings may apply after the value's (their chunk loads on the change).
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute("aria-label") === "Saturday, October 10, 2026 selected",
    cell("cal", "2026-10-10"),
  );
  assert.equal(await page.getAttribute(cell("cal", "2026-10-14"), "data-selected"), null);
  // PageDown: next month, same day; the body re-renders, focus follows.
  await page.keyboard.press("PageDown");
  await waitActive(page, "2026-11-10");
  assert.equal(await page.textContent("#cal .rv-Heading"), "November 2026");
  assert.equal(await page.getAttribute("#cal table[role=grid]", "aria-label"), "Event date, November 2026");
  // Shift+PageDown: next year.
  await page.keyboard.press("Shift+PageDown");
  await waitActive(page, "2027-11-10");
  await page.keyboard.press("Shift+PageUp");
  await page.keyboard.press("PageUp");
  await waitActive(page, "2026-10-10");
  // Arrow past the end of the month moves the visible month.
  await page.keyboard.press("End");
  await waitActive(page, "2026-10-31");
  await page.keyboard.press("ArrowRight");
  await waitActive(page, "2026-11-01");
  assert.equal(await page.textContent("#cal .rv-Heading"), "November 2026");
  // Space selects.
  await page.keyboard.press("Space");
  await page.waitForFunction(() => document.querySelector("#cal-value")?.textContent === "Value: 2026-11-01");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("calendar: repeat arrow keydown events (RAC)", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/calendar");
  await page.click(cell("cal", "2026-10-03"));
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("ArrowRight");
  await page.keyboard.up("ArrowRight");
  await waitActive(page, "2026-10-05");
  await page.close();
});

test("calendar: previous / next buttons, min / max, unavailable dates", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/calendar");
  // Min 2026-10-10: the previous button is disabled, earlier cells are disabled.
  assert.equal(await page.getAttribute('#cal-min [slot="previous"]', "disabled"), "");
  assert.equal(await page.getAttribute(cell("cal-min", "2026-10-09"), "data-disabled"), "true");
  assert.equal(await page.getAttribute(cell("cal-min", "2026-10-09"), "aria-disabled"), "true");
  assert.equal(await page.getAttribute(cell("cal-min", "2026-10-10"), "aria-label"), "Saturday, October 10, 2026, First available date");
  assert.equal(await page.getAttribute(cell("cal-min", "2026-10-13"), "data-unavailable"), "true");
  await page.click('#cal-min [slot="next"]');
  await page.waitForFunction(() => document.querySelector("#cal-min .rv-Heading")?.textContent === "November 2026");
  // Max 2026-11-20: the next button is disabled now.
  await page.waitForFunction(() => document.querySelector('#cal-min [slot="next"]')?.hasAttribute("disabled"));
  assert.equal(await page.getAttribute(cell("cal-min", "2026-11-20"), "aria-label"), "Friday, November 20, 2026, Last available date");
  // Focus moved into the grid when the focused button became disabled.
  await page.waitForFunction(() => document.activeElement?.closest("#cal-min table[role=grid]") != null);
  await page.click('#cal-min [slot="previous"]');
  await page.waitForFunction(() => document.querySelector("#cal-min .rv-Heading")?.textContent === "October 2026");
  // RAC: should not modify selection when trying to select an unavailable date by keyboard.
  await page.click(cell("cal-min", "2026-10-14"));
  await page.keyboard.press("ArrowLeft");
  await waitActive(page, "2026-10-13");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(50);
  assert.equal(await page.getAttribute(cell("cal-min", "2026-10-14"), "data-selected"), "true");
  assert.equal(await page.getAttribute(cell("cal-min", "2026-10-13"), "data-selected"), null);
  // Clicking an unavailable date selects nothing. It is `aria-disabled` (RA useCalendarCell: not selectable), so
  // Playwright's actionability check would wait forever: force the click.
  await page.click(cell("cal-min", "2026-10-13"), { force: true });
  assert.equal(await page.getAttribute(cell("cal-min", "2026-10-13"), "data-selected"), null);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("calendar: multiple selection (RAC)", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/calendar");
  assert.equal(await page.getAttribute("#cal-multi table[role=grid]", "aria-multiselectable"), "true");
  await page.click(cell("cal-multi", "2026-10-08"));
  await page.waitForFunction(() => document.querySelector("#multi-value")?.textContent === "Many: 2026-10-08");
  await page.click(cell("cal-multi", "2026-10-12"));
  await page.waitForFunction(() => document.querySelector("#multi-value")?.textContent === "Many: 2026-10-08,2026-10-12");
  assert.equal(await page.getAttribute(cell("cal-multi", "2026-10-12"), "data-selected"), "true");
  await page.click(cell("cal-multi", "2026-10-12"));
  await page.waitForFunction(() => document.querySelector("#multi-value")?.textContent === "Many: 2026-10-08");
  assert.equal(await page.getAttribute(cell("cal-multi", "2026-10-12"), "data-selected"), null);
  await page.close();
});

test("calendar: hover / press / focus-visible data attributes (RAC)", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/calendar");
  const target = cell("cal", "2026-10-07");
  // First hover loads the chunk; hover again once it is in.
  await page.hover(target);
  await page.hover(cell("cal", "2026-10-08"));
  await page.hover(target);
  await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute("data-hovered") === "true", target);
  await page.mouse.move(0, 0);
  await page.waitForFunction((sel) => !document.querySelector(sel)?.hasAttribute("data-hovered"), target);
  const box = (await page.locator(target).boundingBox())!;
  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.down();
  assert.equal(await page.getAttribute(target, "data-pressed"), "true");
  await page.mouse.up();
  assert.equal(await page.getAttribute(target, "data-pressed"), null);
  assert.equal(await page.getAttribute(target, "data-focus-visible"), null, "pointer focus is not focus-visible");
  await page.keyboard.press("ArrowRight");
  await waitActive(page, "2026-10-08");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-focus-visible") === "true");
  await page.close();
});

test("calendar: RTL swaps left / right", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/calendar");
  await page.focus(cell("cal-ar", "2026-10-14"));
  await page.keyboard.press("ArrowLeft");
  await waitActive(page, "2026-10-15");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await waitActive(page, "2026-10-13");
  await page.close();
});

test("calendar: two visible months, pageBehavior single", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/calendar");
  assert.equal(await page.locator("#cal-two table[role=grid]").count(), 2);
  assert.equal(await page.getAttribute("#cal-two table[role=grid]:nth-of-type(1)", "aria-label"), "Two months, October 2026");
  assert.equal(await page.getAttribute("#cal-two table[role=grid]:nth-of-type(2)", "aria-label"), "Two months, November 2026");
  assert.equal(await page.getAttribute("#cal-two", "aria-label"), "Two months, October to November 2026");
  await page.click('#cal-two [slot="next"]');
  await page.waitForFunction(() => document.querySelector("#cal-two")?.getAttribute("aria-label") === "Two months, November to December 2026");
  // Keyboard into the second month keeps both grids.
  await page.focus(cell("cal-two", "2026-11-14"));
  await page.keyboard.press("PageDown");
  await waitActive(page, "2026-12-14");
  assert.equal(await page.getAttribute("#cal-two", "aria-label"), "Two months, November to December 2026");
  // PageDown moves one month; past the visible range the months realign to start there.
  await page.keyboard.press("PageDown");
  await waitActive(page, "2027-01-14");
  assert.equal(await page.getAttribute("#cal-two", "aria-label"), "Two months, January to February 2027");
  await page.close();
});

test("range calendar: press, hover preview, keyboard selection, Escape", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/calendar");
  assert.equal(await page.getAttribute("#range table[role=grid]", "aria-multiselectable"), "true");
  assert.equal(await page.getAttribute(cell("range", "2026-10-05"), "data-selection-start"), "true");
  assert.equal(await page.getAttribute(cell("range", "2026-10-09"), "data-selection-end"), "true");
  assert.equal(await page.getAttribute(cell("range", "2026-10-07"), "data-selected"), "true");
  assert.match(
    (await page.getAttribute(cell("range", "2026-10-05"), "aria-label"))!,
    /^Selected Range: Monday, October 5 to Friday, October 9, 2026, Monday, October 5, 2026 selected$/,
  );
  // Mouse: press 12, hover 15 (preview), press 16.
  await page.click(cell("range", "2026-10-12"));
  await page.waitForFunction(() => document.querySelector('#range [data-date="2026-10-12"]')?.getAttribute("data-selection-start") === "true");
  await page.hover(cell("range", "2026-10-15"));
  await page.waitForFunction(() => document.querySelector('#range [data-date="2026-10-14"]')?.getAttribute("data-selected") === "true");
  assert.equal(await page.getAttribute(cell("range", "2026-10-07"), "data-selected"), null);
  assert.equal(await page.getAttribute(cell("range", "2026-10-15"), "aria-describedby"), "range-finish-prompt");
  await page.click(cell("range", "2026-10-16"));
  await page.waitForFunction(() => document.querySelector("#range-value")?.textContent === "Range: 2026-10-12..2026-10-16");
  // Drag: down on 20, move to 22, up.
  const a = (await page.locator(cell("range", "2026-10-20")).boundingBox())!;
  const b = (await page.locator(cell("range", "2026-10-22")).boundingBox())!;
  await page.mouse.move(a.x + 5, a.y + 5);
  await page.mouse.down();
  await page.mouse.move(b.x + 5, b.y + 5, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector("#range-value")?.textContent === "Range: 2026-10-20..2026-10-22");
  // Keyboard: Enter anchors (focus auto-advances a day), arrows extend, Enter completes.
  await page.focus(cell("range", "2026-10-26"));
  await page.keyboard.press("Enter");
  await waitActive(page, "2026-10-27");
  await page.keyboard.press("ArrowRight");
  await waitActive(page, "2026-10-28");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#range-value")?.textContent === "Range: 2026-10-26..2026-10-28");
  // Escape cancels a selection in progress.
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(50);
  assert.equal(await page.textContent("#range-value"), "Range: 2026-10-26..2026-10-28");
  assert.equal(await page.getAttribute(cell("range", "2026-10-26"), "data-selection-start"), "true");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("range calendar: focus leaving mid-selection commits (commitBehavior select)", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/calendar");
  await page.focus(cell("range", "2026-10-12"));
  // RA useCalendarCell: a keyboard press starting a range advances focus to the next available day.
  await page.keyboard.press("Enter");
  await waitActive(page, "2026-10-13");
  await page.keyboard.press("ArrowRight");
  // Paging inside the calendar keeps the selection in progress.
  await page.keyboard.press("PageDown");
  await waitActive(page, "2026-11-14");
  await page.keyboard.press("PageUp");
  await waitActive(page, "2026-10-14");
  assert.equal(await page.textContent("#range-value"), "Range: 2026-10-05..2026-10-09");
  await page.focus("#cal-value").catch(() => {});
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.waitForFunction(() => document.querySelector("#range-value")?.textContent === "Range: 2026-10-12..2026-10-14");
  await page.close();
});
