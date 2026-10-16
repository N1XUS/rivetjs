// P3-COLLECTIONS — resumed Table stories (`/table`): SSR classes + HeroUI CSS; upstream table.test cases on a real browser:
// row selection through the row checkbox (two-way `selectedKeys`), sort toggle on the Member column (two-way `sortDescriptor`,
// rows re-sorted, indicator direction), typing into a nested input / textarea / select / contenteditable keeps focus (no grid
// typeahead), `keyboardNavigationBehavior="arrow"` moves focus to the matching row header, typeahead from a non-editable cell.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage();
  const seen = watch(page);
  try {
    await page.goto(s.origin + "/table");
    await body(page);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
}

const focusedText = (page: Page) => page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");

test("table: SSR shell classes, grid role, HeroUI CSS", () =>
  onPage(async (page) => {
    assert.equal(await page.getAttribute("#tbl", "class"), "table-root table-root--primary");
    assert.equal(await page.getAttribute("#tbl", "data-slot"), "table");
    assert.equal(await page.getAttribute("#tbl-grid", "role"), "grid");
    assert.match((await page.getAttribute("#tbl-grid", "class")) ?? "", /table__content/);
    assert.equal(await page.$$eval("#tbl-grid tbody tr", (els) => els.length), 3);
    assert.equal(await page.$eval("#tbl", (el) => getComputedStyle(el).display), "grid");
    assert.equal(await page.$eval("#tbl-grid thead th[aria-sort]", (el) => el.getAttribute("aria-sort")), "ascending");
  }));

test("table (upstream): toggling row selection via the row checkbox", () =>
  onPage(async (page) => {
    await page.click("#tbl-grid tbody tr[data-key='2'] label");
    await page.waitForFunction(() => document.querySelector("#tbl-sel")?.textContent === "2");
    assert.equal(await page.getAttribute("#tbl-grid tbody tr[data-key='2']", "aria-selected"), "true");
    await page.click("#tbl-grid thead label");
    await page.waitForFunction(() => document.querySelector("#tbl-sel")?.textContent === "all");
  }));

test("table (upstream): toggling sort re-sorts the rows and flips the indicator", () =>
  onPage(async (page) => {
    assert.deepEqual(await page.$$eval("#tbl-grid tbody tr", (els) => els.map((el) => el.getAttribute("data-key"))), ["2", "1", "3"]);
    await page.click("#tbl-grid [data-slot=table-sortable-column-header]");
    await page.waitForFunction(() => document.querySelector("#tbl-sort")?.textContent === "name descending");
    await page.waitForFunction(() => [...document.querySelectorAll("#tbl-grid tbody tr")].map((el) => el.getAttribute("data-key")).join() === "3,1,2");
    assert.equal(await page.getAttribute("#tbl-grid [data-slot=table-sortable-column-indicator]", "data-direction"), "descending");
    assert.equal(await page.$eval("#tbl-grid thead th[aria-sort]", (el) => el.getAttribute("aria-sort")), "descending");
  }));

for (const [id, selector, typed] of [
  ["tbl-input", "input", true],
  ["tbl-textarea", "textarea", true],
  ["tbl-select", "select", false],
] as const) {
  test(`table (upstream): matching letter keystrokes in a nested ${selector} keep focus`, () =>
    onPage(async (page) => {
      const editable = `#${id} ${selector}[aria-label='Alpha value'], #${id} [aria-label='Alpha value'] ${selector}, #${id} ${selector}`;
      await page.click(editable);
      await page.waitForFunction((sel) => document.activeElement === document.querySelector(sel), editable);
      await page.keyboard.press("y");
      assert.equal(await page.evaluate((sel) => document.activeElement === document.querySelector(sel), editable), true);
      if (typed) assert.equal(await page.$eval(editable, (el) => (el as HTMLInputElement).value), "y");
    }));
}

test("table (upstream): matching letter keystrokes in a nested contenteditable keep focus", () =>
  onPage(async (page) => {
    await page.click("#tbl-ce [role=textbox]");
    await page.waitForFunction(() => document.activeElement === document.querySelector("#tbl-ce [role=textbox]"));
    await page.keyboard.press("y");
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelector("#tbl-ce [role=textbox]")), true);
  }));

test("table (upstream): keyboardNavigationBehavior arrow → typeahead moves to the matching row header", () =>
  onPage(async (page) => {
    await page.click("#tbl-arrow input");
    await page.waitForFunction(() => document.activeElement === document.querySelector("#tbl-arrow input"));
    await page.keyboard.press("y");
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "rowheader");
    assert.equal(await focusedText(page), "Year Range");
  }));

test("table (upstream): typeahead from non-editable cells", () =>
  onPage(async (page) => {
    await page.click("#tbl-input tbody tr[data-key=alpha] [role=rowheader]");
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === "Alpha");
    await page.keyboard.press("y");
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === "Year Range");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("role")), "rowheader");
  }));
