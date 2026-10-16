// ActionBar clear-selection regression ("action bar - X does nothing"), resumed story app `/action-bar-clear` (shaped like
// the ui-docs `action-bar-basic` example: the X is the first and only handler pressed in the bar): select two options →
// press X (mouse / Enter / Space) → no option selected, the bar is closed (`data-open` removed), the count is 0.
// `/action-bar-clear-grid` (the `action-bar-with-data-grid` example): row checkboxes select, X clears, Archive removes rows.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 700 } });
  try {
    await body(page);
  } finally {
    await page.close();
  }
}

const state = (page: Page) =>
  page.evaluate(() => ({
    open: document.getElementById("abc")!.getAttribute("data-open"),
    selected: [...document.querySelectorAll("#abc-lb [role=option]")].filter((o) => o.getAttribute("aria-selected") === "true").length,
    checked: document.querySelectorAll("#abc-lb [role=option][data-selected]").length,
    count: document.getElementById("abc-count")!.textContent,
  }));

async function selectTwo(page: Page): Promise<void> {
  await page.goto(s.origin + "/action-bar-clear");
  await page.click("#abc-lb [role=option] >> nth=0");
  await page.click("#abc-lb [role=option] >> nth=2");
  await page.waitForFunction(() => document.getElementById("abc-count")!.textContent === "2");
  assert.deepEqual(await state(page), { open: "true", selected: 2, checked: 2, count: "2" });
}

const closed = { open: null, selected: 0, checked: 0, count: "0" };

async function waitClosed(page: Page): Promise<void> {
  await page.waitForFunction(() => !document.getElementById("abc")!.hasAttribute("data-open"), undefined, { timeout: 2000 }).catch(() => {});
  assert.deepEqual(await state(page), closed);
}

test("action-bar-clear: X by mouse clears the selection and closes the bar", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await selectTwo(page);
    await page.click("#abc-clear");
    await waitClosed(page);
    // Selecting again re-opens it; X clears again.
    await page.click("#abc-lb [role=option] >> nth=1");
    await page.waitForFunction(() => document.getElementById("abc")!.getAttribute("data-open") === "true");
    await page.click("#abc-clear");
    await waitClosed(page);
    assert.deepEqual(seen.errors, []);
  }));

for (const key of ["Enter", " "]) {
  test(`action-bar-clear: X by keyboard (${key === " " ? "Space" : key}) clears the selection and closes the bar`, () =>
    onPage(async (page) => {
      const seen = watch(page);
      await selectTwo(page);
      // Tab from the list enters the toolbar on its first action; arrow keys reach the X (toolbar roving focus).
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement?.id), "abc-download");
      // (cold page: the toolbar's key handler chunk loads on the first key; wait for each move)
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(() => document.activeElement?.id !== "abc-download");
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(() => document.activeElement?.id === "abc-clear");
      await page.keyboard.press(key);
      await waitClosed(page);
      assert.deepEqual(seen.errors, []);
    }));
}

const gridState = (page: Page) =>
  page.evaluate(() => ({
    open: document.getElementById("abcg")!.getAttribute("data-open"),
    checked: [...document.querySelectorAll("#abcg-grid [data-rv-select]")].filter((c) => c.getAttribute("aria-checked") === "true").length,
    rows: document.querySelectorAll("#abcg-grid [data-rv-select]").length,
    count: document.getElementById("abcg-count")!.textContent,
  }));

test("action-bar-clear: DataGrid row checkboxes select, X clears and closes, Archive removes rows", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/action-bar-clear-grid");
    for (const n of [0, 2, 3]) {
      await page.click(`#abcg-grid [data-rv-select] >> nth=${n}`);
      await page.waitForFunction((want) => document.getElementById("abcg-count")!.textContent === want, String([0, 2, 3].indexOf(n) + 1), { timeout: 2000 });
    }
    assert.deepEqual(await gridState(page), { open: "true", checked: 3, rows: 4, count: "3" });
    await page.click("#abcg-clear");
    await page.waitForFunction(() => !document.getElementById("abcg")!.hasAttribute("data-open"), undefined, { timeout: 2000 }).catch(() => {});
    assert.deepEqual(await gridState(page), { open: null, checked: 0, rows: 4, count: "0" });
    await page.click("#abcg-grid [data-rv-select] >> nth=1");
    await page.waitForFunction(() => document.getElementById("abcg-count")!.textContent === "1");
    await page.click("#abcg-archive");
    await page.waitForFunction(() => document.querySelectorAll("#abcg-grid [data-rv-select]").length === 3, undefined, { timeout: 2000 }).catch(() => {});
    assert.deepEqual(await gridState(page), { open: null, checked: 0, rows: 3, count: "0" });
    assert.deepEqual(seen.errors, []);
  }));
