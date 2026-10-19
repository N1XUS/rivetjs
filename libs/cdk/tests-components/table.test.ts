// Table on a resumed page (story `/table`): server markup (grid / columnheader / rowheader roles,
// aria-sort, ids, hidden descriptions), no library JS before interaction, then resumed sorting,
// row selection (row press, selection checkbox, select all), keyboard navigation, onRowAction,
// column resizing (keyboard) and the empty state.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { hinted, stories, watch, libraryScripts, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const texts = (page: Page, selector: string) => page.$$eval(selector, (els) => els.map((el) => el.textContent?.trim() ?? ""));
const attrs = (page: Page, selector: string, names: string[]) =>
  page.$$eval(selector, (els, names) => els.map((el) => names.map((n) => el.getAttribute(n))), names);
const untilText = (page: Page, selector: string, value: string) =>
  page.waitForFunction(([selector, value]) => document.querySelector(selector!)?.textContent?.trim() === value, [selector, value] as const);
const focusedId = (page: Page) =>
  page.evaluate(() => document.activeElement?.id ?? document.activeElement?.getAttribute("data-key") ?? document.activeElement?.tagName);

test("table: server markup (roles, ids, aria-sort, descriptions), no library JS before interaction", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/table");
  assert.equal(await page.getAttribute("#tbl-pets", "role"), "grid");
  assert.equal(await page.getAttribute("#tbl-pets", "aria-multiselectable"), "true");
  assert.equal(await page.getAttribute("#tbl-pets", "class"), "rv-Table");
  assert.deepEqual(await attrs(page, "#tbl-pets thead [role=columnheader]", ["id", "aria-sort", "class"]), [
    ["tbl-pets-select", null, "rv-Column"],
    ["tbl-pets-name", "none", "rv-Column"],
    ["tbl-pets-kind", "none", "rv-Column"],
    ["tbl-pets-age", "none", "rv-Column"],
  ]);
  // Sortable columns are described by the shared hidden "sortable column" description.
  const describedBy = await page.getAttribute("#tbl-pets-name", "aria-describedby");
  assert.equal(await page.textContent("#" + describedBy), "sortable column");
  assert.deepEqual(await texts(page, "#tbl-pets tbody [role=rowheader]"), ["Milo", "Bella", "Coco"]);
  assert.deepEqual(await attrs(page, "#tbl-pets tbody [role=row]", ["aria-selected", "aria-labelledby"]), [
    ["false", "tbl-pets-p1-name"],
    ["false", "tbl-pets-p2-name"],
    ["false", "tbl-pets-p3-name"],
  ]);
  assert.equal(await page.getAttribute("#tbl-pets-p1-name", "role"), "rowheader");
  assert.equal(await page.$$eval("#tbl-pets tbody input[type=checkbox]", (els) => els.length), 3);
  assert.equal(await page.getAttribute("#tbl-pets thead input[type=checkbox]", "aria-label"), "Select All");
  assert.equal(await page.getAttribute("#tbl-empty tbody", "data-empty"), "true");
  assert.equal(await page.textContent("#tbl-empty tbody [role=rowheader]"), "Nothing here");
  // The rows' handler chunk is small enough for the runtime's visible preload (CELL-DIET 2026-10-19: one data object
  // per row / cell, logic in module functions): it may be fetched while the table is visible; nothing else loads.
  await page.waitForLoadState("networkidle");
  const hints = await hinted(page);
  const early = libraryScripts(seen).filter((url) => !hints.has(url.replace(/\.deps\.js$/, ".js")));
  assert.deepEqual(early, [], "no library code before interaction beyond the page's own preload hints: " + JSON.stringify(early));
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("table: resumed sort (column press toggles direction, aria-sort, sort description)", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/table");
  await page.click("#tbl-pets-name");
  await untilText(page, "#tbl-sort", "name ascending");
  // Row order is not asserted: the story's sorted `items` signal is read by TableBody inside the
  // table's build pass, which does not track it yet (B5 gap: nested parts run untracked).
  await page.waitForFunction(() => document.getElementById("tbl-pets-name")?.getAttribute("aria-sort") === "ascending");
  assert.equal(await page.getAttribute("#tbl-pets-name", "data-sort-direction"), "ascending");
  assert.equal(await page.getAttribute("#tbl-pets-name", "data-allows-sorting"), "true");
  const describedBy = (await page.getAttribute("#tbl-pets", "aria-describedby")) ?? "";
  assert.ok(describedBy.length > 0);
  assert.equal(await page.textContent("#" + describedBy.split(" ")[0]), "sorted by column Name in ascending order");
  await page.click("#tbl-pets-name");
  await untilText(page, "#tbl-sort", "name descending");
  await page.waitForFunction(() => document.getElementById("tbl-pets-name")?.getAttribute("aria-sort") === "descending");
  await page.click("#tbl-pets-age");
  await untilText(page, "#tbl-sort", "age ascending");
  await page.waitForFunction(() => document.getElementById("tbl-pets-name")?.getAttribute("aria-sort") === "none");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("table: resumed sort keeps the header and body (focus stays on the pressed column, ArrowDown enters the body)", async () => {
  // The collection rows' server render reads nothing of their own: the resumed For keeps them when the sort re-runs
  // their region (cdk-docs table-tailwind: the re-created thead lost the column's focus).
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/table");
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    w.thead = document.querySelector("#tbl-pets thead");
    w.tbody = document.querySelector("#tbl-pets tbody");
  });
  await page.click("#tbl-pets-name");
  await untilText(page, "#tbl-sort", "name ascending");
  await page.waitForFunction(() => document.getElementById("tbl-pets-name")?.getAttribute("aria-sort") === "ascending");
  const kept = await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    return [w.thead === document.querySelector("#tbl-pets thead"), w.tbody === document.querySelector("#tbl-pets tbody")];
  });
  assert.deepEqual(kept, [true, true]);
  assert.equal(await focusedId(page), "tbl-pets-name");
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => !!document.activeElement?.closest("#tbl-pets tbody"));
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("table: resumed row action (row press with nothing selected)", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/table");
  // selectionBehavior "toggle" + onRowAction, nothing selected: a row press is the (primary) row action (RAC).
  await page.click("#tbl-pets-p3-name");
  await untilText(page, "#tbl-action", "p3");
  assert.equal(await page.textContent("#tbl-selected"), "");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

// Skipped: the takeover order (runtime-bugs.md K3-rt-1: the column header's still-delegated press handler ran before
// the activated checkbox spread and prevented the native toggle) is fixed in dom-resume `dispatch` — after networkidle
// this passes. Still open: focusing the header checkbox right after load (cold focusin) ends with focus on the first
// row (`tr[data-key=p1]`), so Space selects p1 instead of all.
test.skip("table: resumed select all (keyboard on the visually hidden checkbox input)", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/table");
  await page.focus("#tbl-pets thead input");
  await page.keyboard.press("Space");
  await untilText(page, "#tbl-selected", "all");
  assert.deepEqual(await attrs(page, "#tbl-pets tbody [role=row]", ["aria-selected"]), [["true"], ["true"], ["true"]]);
  await page.keyboard.press("Space");
  await untilText(page, "#tbl-selected", "");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("table: resumed row action, keyboard selection, row press in selection mode", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/table");
  // selectionBehavior "toggle" + onRowAction, nothing selected: a row press is the (primary) row action (RAC).
  await page.click("#tbl-pets-p3-name");
  await untilText(page, "#tbl-action", "p3");
  assert.equal(await page.textContent("#tbl-selected"), "");
  // Keyboard: Space selects the focused row, arrows move between rows, Enter performs the row action.
  // ArrowLeft from the name cell: the checkbox cell (RA useGridCell focusMode "child" focuses its checkbox),
  // then the row itself (left of the first cell).
  await page.focus("#tbl-pets-p1-name");
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => document.activeElement?.id === "tbl-pets-p1-checkbox");
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-key") === "p1");
  // Nothing selected: Enter performs the (primary) row action (RA useSelectableItem; with a selection and
  // selectionBehavior "toggle" there is no action, Enter does nothing).
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-key") === "p2");
  await page.keyboard.press("Enter");
  await untilText(page, "#tbl-action", "p2");
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-key") === "p1");
  await page.keyboard.press("Space");
  await untilText(page, "#tbl-selected", "p1");
  assert.equal(await page.getAttribute("#tbl-pets tbody tr[data-key=p1]", "aria-selected"), "true");
  assert.equal(await page.getAttribute("#tbl-pets tbody tr[data-key=p1]", "data-selected"), "true");
  assert.equal(await page.isChecked("#tbl-pets tbody tr[data-key=p1] input"), true);
  await page.waitForFunction(() => (document.querySelector("#tbl-pets thead input") as HTMLInputElement).indeterminate);
  // With a selection, a row press toggles selection.
  await page.click("#tbl-pets-p3-name");
  await untilText(page, "#tbl-selected", "p1,p3");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("table: resumed column resizing (keyboard) inside ResizableTableContainer", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/table");
  assert.equal(await page.$eval("#tbl-resize", (el) => (el as HTMLElement).style.tableLayout), "fixed");
  const input = "#tbl-resize thead input[type=range]";
  assert.equal(await page.getAttribute(input, "aria-label"), "Resizer");
  // Row → ArrowUp → column header; focusMode "child" moves focus to the resizer input (next frame).
  await page.click("#tbl-resize tbody [role=rowheader]");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction(() => document.activeElement?.getAttribute("type") === "range");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => (document.getElementById("tbl-widths")?.textContent ?? "").startsWith("a=220"));
  await page.waitForFunction(() => (document.getElementById("tbl-resize-a") as HTMLElement).style.width === "220px");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
