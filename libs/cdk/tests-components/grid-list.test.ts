// GridList on a resumed page (story `/grid-list`): server markup (grid / row / gridcell roles,
// aria-selected, disabled rows), no library JS before interaction, then resumed selection,
// keyboard navigation, onAction and createListData removal from a row Button.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, libraryScripts, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const attrs = (page: import("playwright").Page, selector: string, names: string[]) =>
  page.$$eval(selector, (els, names) => els.map((el) => names.map((n) => el.getAttribute(n))), names);
const until = (page: import("playwright").Page, selector: string, name: string, values: (string | null)[]) =>
  page.waitForFunction(
    ([selector, name, values]) =>
      JSON.stringify([...document.querySelectorAll(selector as string)].map((el) => el.getAttribute(name as string))) === JSON.stringify(values),
    [selector, name, values] as const,
  );

test("grid list: server markup, resumed selection, keyboard, onAction", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/grid-list");
  assert.equal(await page.getAttribute("#gl-pets", "role"), "grid");
  assert.equal(await page.getAttribute("#gl-pets", "aria-multiselectable"), "true");
  assert.equal(await page.getAttribute("#gl-pets", "class"), "rv-GridList");
  assert.deepEqual(await attrs(page, "#gl-pets [role=row]", ["data-key", "aria-selected", "aria-disabled", "aria-rowindex"]), [
    // aria-rowindex only when virtualized (RA useGridListItem).
    ["cat", "true", null, null],
    ["dog", "false", null, null],
    ["fish", null, "true", null], // not selectable: no aria-selected (RA canSelectItem)
  ]);
  assert.equal(await page.$$eval("#gl-pets [role=row] > [role=gridcell]", (els) => els.length), 3);
  assert.deepEqual(libraryScripts(seen), [], "no library code before interaction");

  // Toggle selection (checkbox-style: selectionBehavior toggle).
  await page.click("#gl-pets [data-key=dog]");
  await until(page, "#gl-pets [role=row]", "aria-selected", ["true", "true", null]);
  assert.equal(await page.textContent("#gl-pets-selected"), "cat,dog");
  // Arrow keys move focus; the disabled row is skipped.
  await page.keyboard.press("ArrowUp");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-key")), "cat");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-key")), "dog");
  await page.keyboard.press("Space");
  await until(page, "#gl-pets [role=row]", "aria-selected", ["true", "false", null]);
  // Toggle behavior: onAction is the primary (Enter / press) action only while the selection is empty (RA useSelectableItem).
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Space");
  await until(page, "#gl-pets [role=row]", "aria-selected", ["false", "false", null]);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#gl-pets-action")?.textContent === "cat");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("grid list: row aria-labelledby (row + description id) survives a selection change after resume", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/grid-list");
  const labelled = () => attrs(page, "#gl-desc [role=row]", ["aria-labelledby"]);
  const before = await labelled();
  assert.equal(before[0][0]?.startsWith("gl-desc-d1 "), true, String(before));
  await page.click("#gl-desc [data-key=d2]");
  await until(page, "#gl-desc [role=row]", "aria-selected", ["false", "true"]);
  await page.waitForTimeout(100);
  assert.deepEqual(await labelled(), before);
  assert.equal(
    await page.evaluate(() => !!document.getElementById(document.querySelector("#gl-desc [data-key=d1]")!.getAttribute("aria-labelledby")!.split(" ")[1])),
    true,
  );
  await page.close();
});

/** console.error messages (resume errors are reported there, not as page errors). */
const consoleErrors = (page: import("playwright").Page): string[] => {
  const errors: string[] = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  return errors;
};

test("grid list: createListData items, remove from a row Button after resume", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  const logged = consoleErrors(page);
  await page.goto(s.origin + "/grid-list");
  assert.equal(await page.getAttribute("#gl-data", "data-layout"), "grid");
  assert.deepEqual(await attrs(page, "#gl-data [role=row]", ["data-key"]), [["a"], ["b"], ["c"]]);
  await page.click('#gl-data button[aria-label="Remove Bravo"]');
  await until(page, "#gl-data [role=row]", "data-key", ["a", "c"]);
  // Default stack layout ("arrow" keyboard navigation).
  await page.click('#gl-stack button[aria-label="Remove Bravo"]');
  await until(page, "#gl-stack [role=row]", "data-key", ["a", "c"]);
  await page.click('#gl-stack button[aria-label="Remove Alpha"]');
  await until(page, "#gl-stack [role=row]", "data-key", ["c"]);
  assert.deepEqual(seen.errors, []);
  assert.deepEqual(logged, []);
  await page.close();
});

test("grid list layout grid: Tab from a focused row moves to the row's Button (RA keyboardNavigationBehavior tab)", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/grid-list");
  await page.focus("#gl-data [role=row][data-key=a]");
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-key") === "b");
  await page.keyboard.press("Tab");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Remove Bravo");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("grid list SSR (port of RAC GridList.ssr.test.js): server rows, conditional item after resume", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/grid-list");
  const texts = () => page.$$eval("#gl-ssr [role=row]", (els) => els.map((el) => el.textContent));
  assert.deepEqual(await texts(), ["Left", "Middle", "Right"]);
  await page.click("#gl-ssr-show");
  await page.waitForFunction(() => document.querySelectorAll("#gl-ssr [role=row]").length === 4);
  assert.deepEqual(await texts(), ["Left", "Middle", "Extra", "Right"]);
  assert.deepEqual(seen.errors, []);
  await page.close();
});
