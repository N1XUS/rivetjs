// TagGroup on a resumed page (story `/tag-group`): port of RAC TagGroup.ssr.test.js (server rows, conditional
// tag after resume) + resumed selection and removal (remove button, Delete key) with createListData.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, libraryScripts, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const keys = (page: import("playwright").Page, selector: string) => page.$$eval(selector, (els) => els.map((el) => el.getAttribute("data-key")));

test("tag group SSR (port of RAC TagGroup.ssr.test.js): server rows, conditional tag after resume", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/tag-group");
  const texts = () => page.$$eval("#tg-ssr [role=row]", (els) => els.map((el) => el.textContent));
  assert.deepEqual(await texts(), ["Left", "Middle", "Right"]);
  assert.equal(await page.$$eval("#tg-ssr [role=grid]", (els) => els.length), 1);
  assert.deepEqual(libraryScripts(seen), [], "no library code before interaction");
  await page.click("#tg-ssr-show");
  await page.waitForFunction(() => document.querySelectorAll("#tg-ssr [role=row]").length === 4);
  assert.deepEqual(await texts(), ["Left", "Middle", "Extra", "Right"]);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("tag group: resumed selection, remove button, Delete key", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/tag-group");
  assert.deepEqual(await keys(page, "#tg-remove [role=row]"), ["news", "travel", "gaming"]);
  assert.equal(await page.getAttribute("#tg-remove [data-key=news]", "data-allows-removing"), "true");
  // Click the tag itself, not its remove button (the theme may center the button under the row center): 4 px into its
  // first line box (CI's Linux fonts wrap the unstyled tag, and its bounding box's corner is the grid's).
  const at = await page.$eval("#tg-remove [data-key=travel]", (el) => {
    const box = el.getClientRects()[0]!;
    return { x: box.x + 4, y: box.y + box.height / 2 };
  });
  await page.mouse.click(at.x, at.y);
  await page.waitForFunction(() => document.querySelector("#tg-remove [data-key=travel]")?.getAttribute("aria-selected") === "true");
  await page.focus("#tg-remove [data-key=gaming]");
  await page.keyboard.press("Delete");
  await page.waitForFunction(() => document.querySelectorAll("#tg-remove [role=row]").length === 2);
  await page.click("#tg-remove [data-key=news] button");
  await page.waitForFunction(() => document.querySelectorAll("#tg-remove [role=row]").length === 1);
  assert.deepEqual(await keys(page, "#tg-remove [role=row]"), ["travel"]);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("tag group: render-function Tag children, resumed remove button", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  const logged: string[] = [];
  page.on("console", (message) => message.type() === "error" && logged.push(message.text()));
  await page.goto(s.origin + "/tag-group");
  assert.deepEqual(await keys(page, "#tg-fn [role=row]"), ["open", "bug", "docs"]);
  assert.equal(await page.$$eval("#tg-fn [data-key=bug] .mark", (els) => els.length), 1);
  // Cold click on the remove button of a tag rendered by a render function.
  await page.click("#tg-fn [data-key=docs] button");
  await page.waitForFunction(() => document.querySelectorAll("#tg-fn [role=row]").length === 2);
  await page.click("#tg-fn [data-key=open] button");
  await page.waitForFunction(() => document.querySelectorAll("#tg-fn [role=row]").length === 1);
  assert.deepEqual(await keys(page, "#tg-fn [role=row]"), ["bug"]);
  assert.deepEqual(seen.errors, []);
  assert.deepEqual(logged, []);
  await page.close();
});
