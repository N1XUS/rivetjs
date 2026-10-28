// Tree on a resumed page (story `/tree`).
// Ported from react-aria-components test/Tree.ssr.test.js (react-spectrum, Apache-2.0, © Adobe):
// server-rendered rows, the same rows after resume (React: hydration), then an update (a conditional
// child item appears). Rivet additions: no library JS before interaction, resumed chevron expand /
// collapse, keyboard, selection and a two-way `expandedKeys` signal.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, libraryScripts, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const rowTexts = (page: import("playwright").Page, tree: string) =>
  page.$$eval(`${tree} [role=row]`, (els) => els.map((el) => (el.textContent ?? "").replace(/Toggle/g, "").trim()));
const untilRows = (page: import("playwright").Page, tree: string, texts: string[]) =>
  page.waitForFunction(
    ([tree, texts]) =>
      JSON.stringify([...document.querySelectorAll(`${tree} [role=row]`)].map((el) => (el.textContent ?? "").replace(/Toggle/g, "").trim())) ===
      JSON.stringify(texts),
    [tree, texts] as const,
  );

test("Tree SSR: should render without errors (server rows, resumed rows, update)", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/tree");
  // Assert that server rendered stuff into the HTML.
  assert.deepEqual(await rowTexts(page, "#tree-files"), ["Documents", "Project", "Photos", "Image 1", "Image 2"]);
  assert.equal(await page.getAttribute("#tree-files", "role"), "treegrid");
  assert.deepEqual(await page.$$eval("#tree-files [role=row]", (els) => els.map((el) => [el.getAttribute("aria-level"), el.getAttribute("aria-expanded")])), [
    ["1", "true"],
    ["2", null], // "project" has no child rows until "Show"
    ["1", "true"],
    ["2", null],
    ["2", null],
  ]);
  // Settle first: a boot the page starts by itself (an idle `clientEffect` trigger) requests its chunks just after
  // `load`, so an assert right after `goto` raced it (TREE-PRE 2026-10-28: red under host load, green alone).
  await page.waitForLoadState("networkidle");
  assert.equal(await page.$('script[type="rivet/boundaries"][data-boot]'), null, "nothing boots by itself");
  assert.deepEqual(libraryScripts(seen), [], "no library code before interaction");

  // And that it updates correctly.
  await page.click("#tree-show");
  await untilRows(page, "#tree-files", ["Documents", "Project", "Weekly Report", "Photos", "Image 1", "Image 2"]);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("Tree: resumed chevron, keyboard, selection, two-way expandedKeys", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/tree");
  assert.deepEqual(await rowTexts(page, "#tree-food"), ["Fruit", "Apple", "Pear", "Vegetables"]);
  assert.equal(await page.getAttribute("#tree-food", "aria-multiselectable"), "true");

  // Chevron expands Vegetables (signal written back).
  await page.click('#tree-food [data-key=veg] [slot="chevron"]');
  await untilRows(page, "#tree-food", ["Fruit", "Apple", "Pear", "Vegetables", "Leek"]);
  await page.waitForFunction(() => document.querySelector("#tree-food-expanded")?.textContent === "fruit,veg");

  // Selection by click, then keyboard: ArrowLeft on a child moves to its parent and collapses it.
  await page.click("#tree-food [data-key=apple]");
  await page.waitForFunction(() => document.querySelector("#tree-food-selected")?.textContent === "apple");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-key")), "fruit");
  await page.keyboard.press("ArrowLeft");
  await untilRows(page, "#tree-food", ["Fruit", "Vegetables", "Leek"]);
  await page.waitForFunction(() => document.querySelector("#tree-food-expanded")?.textContent === "veg");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

/** console.error messages (resume errors are reported there, not as page errors). */
const consoleErrors = (page: import("playwright").Page): string[] => {
  const errors: string[] = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  return errors;
};

test("TreeSection: server rows in row groups, resumed keyboard across sections", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  const logged = consoleErrors(page);
  const response = await page.goto(s.origin + "/tree");
  assert.equal(response?.status(), 200);
  // RAC TreeSection drops the section id from the DOM; the header labels its row group, aria-label otherwise.
  const groups = await page.$$eval("#tree-sections > [role=rowgroup]", (els) =>
    els.map((el) => [el.getAttribute("aria-labelledby"), el.getAttribute("aria-label"), el.querySelector("[role=rowheader]")?.id ?? null]),
  );
  assert.equal(groups.length, 2);
  assert.equal(groups[0]![0], groups[0]![2]);
  assert.deepEqual(groups[1], [null, "Vegetables", null]);
  assert.deepEqual(await rowTexts(page, "#tree-sections > [role=rowgroup]:first-child"), ["Fruit", "Apple", "Pear"]);
  assert.deepEqual(await rowTexts(page, "#tree-sections > [role=rowgroup]:last-child"), ["Leek"]);
  await page.focus("#tree-sections [data-key=sec-pear]");
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-key") === "sec-leek");
  assert.deepEqual(seen.errors, []);
  assert.deepEqual(logged, []);
  await page.close();
});

test("createTreeData on a resumed page: update re-renders the row, remove drops it without errors", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  const logged = consoleErrors(page);
  await page.goto(s.origin + "/tree");
  assert.deepEqual(await rowTexts(page, "#tree-people"), ["David", "John", "Sam", "Emma"]);
  await page.click("#people-rename");
  await untilRows(page, "#tree-people", ["David", "John", "Sam (renamed)", "Emma"]);
  await page.click("#people-remove");
  await untilRows(page, "#tree-people", ["David", "John", "Sam (renamed)"]);
  await page.click("#people-rename");
  await untilRows(page, "#tree-people", ["David", "John", "Sam (renamed) (renamed)"]);
  assert.deepEqual(seen.errors, []);
  assert.deepEqual(logged, []);
  await page.close();
});
