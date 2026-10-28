// Built-collection rows on a resumed page follow node value changes (story `/list-data`, cdk-docs `data-list`, ROW-RERENDER):
// an adopted server row whose node no longer renders like the server's is re-created; unchanged rows keep their DOM element.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const texts = (page: Page, list: string) => page.$$eval(`${list} [role=option]`, (els) => els.map((el) => el.textContent));
const until = (page: Page, list: string, want: string[]) =>
  page.waitForFunction(
    ([list, want]) => JSON.stringify([...document.querySelectorAll(`${list} [role=option]`)].map((el) => el.textContent)) === JSON.stringify(want),
    [list, want] as const,
    { timeout: 5000 },
  );
// Expando marks on the server option elements: a kept row keeps its element.
const mark = (page: Page, list: string) =>
  page.evaluate((list) => document.querySelectorAll(`${list} [role=option]`).forEach((el, i) => ((el as unknown as { mark: number }).mark = i + 1)), list);
const marks = (page: Page, list: string) => page.$$eval(`${list} [role=option]`, (els) => els.map((el) => (el as unknown as { mark?: number }).mark ?? 0));

test("createListData.update re-renders the resumed row; other rows keep their elements", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/list-data");
  assert.deepEqual(await texts(page, "#ld-animals"), ["Aardvark", "Kangaroo", "Snake"]);
  await mark(page, "#ld-animals");
  // First change after resume: an update (the region re-runs and adopts the server rows in the same pass).
  await page.click("#ld-shout");
  await until(page, "#ld-animals", ["Aardvark", "KANGAROO", "Snake"]);
  assert.deepEqual(await marks(page, "#ld-animals"), [1, 0, 3], "only the changed row is re-created");
  assert.equal(await page.getAttribute("#ld-animals [role=option]:nth-child(2)", "data-key"), "2");
  // Equal data in a new object: the row stays.
  await page.click("#ld-same");
  await page.click("#ld-add");
  await until(page, "#ld-animals", ["Aardvark", "KANGAROO", "Snake", "Animal 4"]);
  assert.deepEqual((await marks(page, "#ld-animals")).slice(0, 3), [1, 0, 3]);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("update after another first change (append first, then update)", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/list-data");
  await mark(page, "#ld-animals");
  await page.click("#ld-add");
  await until(page, "#ld-animals", ["Aardvark", "Kangaroo", "Snake", "Animal 4"]);
  await page.click("#ld-shout");
  await until(page, "#ld-animals", ["Aardvark", "KANGAROO", "Snake", "Animal 4"]);
  assert.deepEqual(await marks(page, "#ld-animals"), [1, 0, 3, 0]);
  await page.click("#ld-shout");
  assert.deepEqual(await texts(page, "#ld-animals"), ["Aardvark", "KANGAROO", "Snake", "Animal 4"]);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

// ListBoxSection creates its rows' For in its body: on the derived resume the section's nested list re-creates the
// changed row only, like a client rebuild (the serialized model re-created the section row as a whole).
test("a row of a section's nested For re-renders on a value change (only that row is re-created)", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/list-data");
  assert.deepEqual(await texts(page, "#ld-sections"), ["Pear", "Leek", "Kale"]);
  await mark(page, "#ld-sections");
  await page.click("#ld-veg");
  await until(page, "#ld-sections", ["Pear", "Leek", "KALE"]);
  assert.deepEqual(await marks(page, "#ld-sections"), [1, 2, 0], "the other section and the unchanged row keep their elements");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("virtualized ListBox: a resumed view's option follows an update", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/list-data");
  assert.deepEqual((await texts(page, "#ld-virtual")).slice(0, 3), ["Item 1", "Item 2", "Item 3"]);
  await mark(page, "#ld-virtual");
  await page.click("#ld-virtual-shout");
  await page.waitForFunction(() => document.querySelector("#ld-virtual [data-key='2']")?.textContent === "ITEM 2", undefined, { timeout: 5000 });
  assert.deepEqual((await marks(page, "#ld-virtual")).slice(0, 3), [1, 0, 3]);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

// Resume fuzz `/list-data` (2026-10-20): the first click scrolls the scroller 4px sideways (content 248px in a 240px
// padded box); the engine's first pass clamps that offset and laid out no views, which emptied the rows' For once.
test("virtualized ListBox: the first click on a resumed option keeps every row and focuses the option", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/list-data");
  await mark(page, "#ld-virtual");
  // Handler chunks loaded (idle preload): the engine starts inside the click's own update.
  await page.waitForLoadState("networkidle");
  await page.click("#ld-virtual-option-4");
  await page.waitForFunction(() => document.activeElement?.id === "ld-virtual-option-4", undefined, { timeout: 5000 });
  assert.deepEqual((await marks(page, "#ld-virtual")).slice(0, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("Table: a resumed body row follows an item change; the other row keeps its element", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/list-data");
  const cells = () => page.$$eval("#ld-table tbody [role=row]", (rows) => rows.map((r) => r.textContent));
  assert.deepEqual(await cells(), ["AdaEngineer", "BobDesigner"]);
  await page.evaluate(() => document.querySelectorAll("#ld-table tbody [role=row]").forEach((el, i) => ((el as unknown as { mark: number }).mark = i + 1)));
  await page.click("#ld-table-role");
  await page.waitForFunction(() => document.querySelectorAll("#ld-table tbody [role=row]")[1]?.textContent === "BobManager", undefined, { timeout: 5000 });
  assert.deepEqual(await page.$$eval("#ld-table tbody [role=row]", (rows) => rows.map((r) => (r as unknown as { mark?: number }).mark ?? 0)), [1, 0]);
  assert.deepEqual(seen.errors, []);
  await page.close();
});
