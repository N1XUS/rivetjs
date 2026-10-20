// Autocomplete on a resumed page (story `/autocomplete`, docs example autocomplete-basic): SSR options, no library
// code before interaction, ArrowDown moves virtual focus (aria-activedescendant,
// DOM focus stays in the input), Enter runs the item action (autocomplete/behaviour keydown / focusin / keyup paths).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, libraryScripts, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const options = (page: Page) => page.$$eval("#ac-list [role=option]", (els) => els.map((el) => el.textContent));
const optionCount = (page: Page, n: number, timeout?: number) =>
  page.waitForFunction((n) => document.querySelectorAll("#ac-list [role=option]").length === n, n, { timeout });

test("autocomplete: SSR options, resumed virtual focus, Enter action", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  const response = await page.goto(s.origin + "/autocomplete");
  assert.equal(response?.status(), 200);
  assert.deepEqual(await options(page), ["New file", "Open file", "Save", "Close window"]);
  assert.deepEqual(libraryScripts(seen), [], "no library code before interaction");
  // RAC mergeIds: the ListBox's own id wins over the autocomplete's collection id, aria-controls follows it.
  assert.equal(await page.getAttribute("#ac-input", "aria-controls"), "ac-list");
  await page.click("#ac-input");
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.querySelector("#ac-input")?.getAttribute("aria-activedescendant") === "ac-list-option-new");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "ac-input");
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.querySelector("#ac-input")?.getAttribute("aria-activedescendant") === "ac-list-option-open");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#ac-action")?.textContent === "open");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("autocomplete: resumed typing filters the ListBox", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/autocomplete");
  await page.click("#ac-input");
  await page.waitForLoadState("networkidle");
  await page.keyboard.type("o");
  await optionCount(page, 2, 3000);
  assert.deepEqual(await options(page), ["Open file", "Close window"]);
  await page.close();
});

test("autocomplete: virtual focus after a resumed filter marks the option focused (ListBox not re-created)", async () => {
  // Docs example autocomplete-basic (cdk-docs build check). The ListBox renders its rows inside a compiled `<Provider>` child
  // region: the filter re-runs that region only. Before (eager provide() chain in the body), the filter's first change
  // re-created the whole ListBox with a fresh list state, so the adopted options' resumed `data-focused` bindings never saw
  // the virtual focus (aria-activedescendant moved, `data-focused` stayed unset).
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/autocomplete");
  await page.evaluate(() => ((window as unknown as { listBox: Element | null }).listBox = document.getElementById("ac-list")));
  await page.click("#ac-input");
  await page.waitForLoadState("networkidle");
  await page.keyboard.type("file");
  await optionCount(page, 2, 3000);
  assert.deepEqual(await options(page), ["New file", "Open file"]);
  assert.equal(
    await page.evaluate(() => (window as unknown as { listBox: Element | null }).listBox === document.getElementById("ac-list")),
    true,
    "listbox kept",
  );
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.querySelector("#ac-input")?.getAttribute("aria-activedescendant") === "ac-list-option-new");
  await page.waitForFunction(() => document.querySelector("#ac-list-option-new")?.getAttribute("data-focused") === "true", undefined, { timeout: 3000 });
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.querySelector("#ac-list-option-open")?.getAttribute("data-focused") === "true", undefined, { timeout: 3000 });
  assert.equal(await page.getAttribute("#ac-list-option-new", "data-focused"), null);
  assert.deepEqual(seen.errors, []);
  await page.close();
});
