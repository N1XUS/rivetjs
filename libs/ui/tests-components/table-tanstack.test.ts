// TANSTACK — resumed TanStack Table story (`/table-tanstack`, `@rivetjs/ui/table-tanstack` on the ui Table): the server
// renders the first page of TanStack's row model; the FIRST click on a sortable header of the resumed page sorts the
// rows (adopt run rebuilds the table instance from the component's signals), the second flips the direction; a page
// link pages the sorted model; no page errors.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const names = (page: Page) => page.$$eval("#tt-grid tbody tr", (els) => els.map((el) => el.children[0]!.textContent!.trim()));

test("table-tanstack: resumed page — first header click sorts, second flips, page link pages the sorted model", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  try {
    await page.goto(s.origin + "/table-tanstack");
    await page.waitForLoadState("networkidle");
    // Server markup: first page (3 rows) in data order, chip cells, grid path.
    assert.equal(await page.getAttribute("#tt-grid", "role"), "grid");
    assert.deepEqual(await names(page), ["Kate", "John", "Sara"]);
    assert.equal(await page.textContent("#tt-grid tbody tr:nth-child(3) [data-slot=chip]"), "Inactive");
    assert.equal(await page.textContent("#tt-sort"), "none");
    // Nothing ran yet: the story's code waits for the first input.
    assert.equal(seen.errors.length, 0);
    await page.click("#tt-grid thead th:nth-child(1)");
    await page.waitForFunction(() => document.querySelector("#tt-sort")?.textContent === "name ascending");
    await page.waitForFunction(() => document.querySelector("#tt-grid tbody tr")?.children[0]?.textContent?.trim() === "Abel");
    assert.deepEqual(await names(page), ["Abel", "John", "Kate"]);
    assert.equal(await page.getAttribute("#tt-grid thead th:nth-child(1)", "aria-sort"), "ascending");
    await page.click("#tt-grid thead th:nth-child(1)");
    await page.waitForFunction(() => document.querySelector("#tt-sort")?.textContent === "name descending");
    assert.deepEqual(await names(page), ["Sara", "Mira", "Kate"]);
    await page.click("[data-slot=pagination-link]:not([aria-current])");
    await page.waitForFunction(() => document.querySelector("#tt-page")?.textContent === "1");
    assert.deepEqual(await names(page), ["John", "Abel"]);
    await page.click("[data-slot=pagination-previous]");
    await page.waitForFunction(() => document.querySelector("#tt-page")?.textContent === "0");
    assert.deepEqual(await names(page), ["Sara", "Mira", "Kate"]);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
});
