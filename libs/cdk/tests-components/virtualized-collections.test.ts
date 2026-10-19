// ListBox and Table inside the cdk Virtualizer (collection mode, RAC `<Virtualizer layout={…}>`) on a resumed page
// (story `/virtualized-collections`, 1000 items each): the server renders the first window only, no library code
// runs before interaction, then the cold scroll starts the engine, a click selects, ArrowDown ×30 walks focus past
// the window edge (rows scroll in, focus is kept), Space selects.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { hinted, stories, watch, libraryScripts, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const count = (page: Page, selector: string) => page.$$eval(selector, (els) => els.length);
const untilText = (page: Page, selector: string, value: string) =>
  page
    .waitForFunction(([selector, value]) => document.querySelector(selector!)?.textContent?.trim() === value, [selector, value] as const, { timeout: 5000 })
    .catch(async () => assert.equal((await page.textContent(selector))?.trim(), value));
/** The focused element's `data-key` (an option, or a table cell `<row>.$.<column>`). */
const focusedKey = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute("data-key") ?? document.activeElement?.tagName ?? "");
/** Whether the element of `selector` lies inside the scroll container `host` (visible part). */
const inView = (page: Page, host: string, selector: string) =>
  page.evaluate(
    ([host, selector]) => {
      const box = document.querySelector(host!)!.getBoundingClientRect();
      const el = document.querySelector(selector!)?.getBoundingClientRect();
      return !!el && el.top >= box.top - 1 && el.bottom <= box.bottom + 1;
    },
    [host, selector] as const,
  );

async function open(): Promise<Page> {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/virtualized-collections");
  return page;
}

test("virtualized collections: server window only, no library code before interaction", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/virtualized-collections");
  assert.equal(await page.getAttribute("#vlist", "role"), "listbox");
  const options = await count(page, "#vlist [role=option]");
  assert.ok(options > 5 && options < 30, `listbox renders its first window (${options} options)`);
  assert.equal(await page.getAttribute("#vlist [data-key='1']", "aria-posinset"), "1");
  assert.equal(await page.getAttribute("#vlist [data-key='1']", "aria-setsize"), "1000");
  // Content sized for every item: the scrollbar covers the whole list.
  assert.ok((await page.$eval("#vlist", (el) => el.scrollHeight)) >= 1000 * 32);
  assert.equal(await page.getAttribute("#vtable", "role"), "grid");
  assert.equal(await page.$eval("#vtable", (el) => el.tagName), "DIV", "virtualized table renders divs (RAC useElementType)");
  const rows = await count(page, "#vtable [role=rowgroup] [role=row]");
  assert.ok(rows > 5 && rows < 30, `table renders its first window (${rows} rows incl. header)`);
  assert.equal(await page.getAttribute("#vtable [role=row][data-key='1']", "aria-rowindex"), "2");
  await page.waitForLoadState("networkidle");
  const hints = await hinted(page);
  const early = libraryScripts(seen).filter((url) => !hints.has(url.replace(/\.deps\.js$/, ".js")));
  assert.deepEqual(early, [], "no library code before interaction beyond the page's own preload hints: " + JSON.stringify(early));
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("virtualized listbox: cold scroll, click selects, ArrowDown ×30 keeps focus and scrolls, Space selects", async () => {
  const page = await open();
  const seen = watch(page);
  const box = (await page.$("#vlist"))!;
  const rect = (await box.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.wheel(0, 3200);
  // Cold scroll: the engine starts and renders the new window (item 101 at 3200px).
  await page.waitForSelector("#vlist [role=option][data-key='101']", { state: "attached", timeout: 5000 }).catch(async (e) => {
    throw new Error(
      JSON.stringify({
        errors: seen.errors,
        top: await page.$eval("#vlist", (el) => el.scrollTop),
        keys: await page.$$eval("#vlist [role=option]", (els) => els.map((x) => x.getAttribute("data-key"))),
      }) + e,
    );
  });
  assert.equal(await count(page, "#vlist [role=option][data-key='1']"), 0, "the first window left the DOM");
  assert.ok((await count(page, "#vlist [role=option]")) < 30);
  // First trusted mouse click of the document: its DOM updates flush one task later.
  await page.click("#vlist [role=option][data-key='103']");
  await untilText(page, "#vlist-value", "103");
  assert.equal(await page.getAttribute("#vlist [data-key='103']", "aria-selected"), "true");
  assert.equal(await focusedKey(page), "103");
  for (let i = 0; i < 30; i++) await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-key") === "133", undefined, { timeout: 5000 });
  assert.ok(await inView(page, "#vlist", "#vlist [data-key='133']"), "the focused option scrolled into view");
  await page.keyboard.press("Space");
  await untilText(page, "#vlist-value", "103,133");
  assert.equal(await page.getAttribute("#vlist [data-key='133']", "aria-selected"), "true");
  // End / Home reach the far ends (scrollToItem through the persisted focused key).
  await page.keyboard.press("End");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-key") === "1000", undefined, { timeout: 5000 });
  await page.keyboard.press("Home");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-key") === "1", undefined, { timeout: 5000 });
  assert.ok(await inView(page, "#vlist", "#vlist [data-key='1']"));
  // PageDown: the layout is the keyboard delegate's layout delegate (a page = the viewport height, 10 rows).
  await page.keyboard.press("PageDown");
  await page.waitForFunction(() => Number(document.activeElement?.getAttribute("data-key")) >= 9, undefined, { timeout: 5000 });
  const paged = Number(await focusedKey(page));
  assert.ok(paged >= 9 && paged <= 12, `PageDown moved one page (${paged})`);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("virtualized table: cold scroll, click selects a row, ArrowDown ×30 keeps focus and scrolls, Space selects", async () => {
  const page = await open();
  const seen = watch(page);
  const box = (await page.$("#vtable"))!;
  const rect = (await box.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.wheel(0, 3200);
  await page.waitForSelector("#vtable [role=row][data-key='101']", { state: "attached", timeout: 5000 });
  assert.equal(await count(page, "#vtable [role=row][data-key='1']"), 0, "the first window left the DOM");
  // Rows rendered in the browser get their cell views too.
  assert.equal(await count(page, "#vtable [role=row][data-key='101'] [role=rowheader], #vtable [role=row][data-key='101'] [role=gridcell]"), 2);
  // The header row stays (sticky).
  assert.equal(await count(page, "#vtable [role=columnheader]"), 2);
  await page.click("#vtable [role=row][data-key='103'] [role=rowheader]");
  await untilText(page, "#vtable-value", "103");
  assert.equal(await page.getAttribute("#vtable [role=row][data-key='103']", "aria-selected"), "true");
  for (let i = 0; i < 30; i++) await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => /^133(\.|$)/.test(document.activeElement?.getAttribute("data-key") ?? ""), undefined, { timeout: 5000 });
  assert.ok(await inView(page, "#vtable", "#vtable [role=row][data-key='133']"), "the focused row scrolled into view");
  // ArrowLeft from the first cell focuses the row (RA useGridCell); Space selects the focused row.
  if ((await focusedKey(page)) !== "133") {
    await page.keyboard.press("ArrowLeft");
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-key") === "133", undefined, { timeout: 5000 });
  }
  await page.keyboard.press("Space");
  await untilText(page, "#vtable-value", "103,133");
  assert.equal(await page.getAttribute("#vtable [role=row][data-key='133']", "aria-selected"), "true");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
