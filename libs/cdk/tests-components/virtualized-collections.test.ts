// ListBox and Table inside the cdk Virtualizer (collection mode, RAC `<Virtualizer layout={…}>`) on a resumed page
// (story `/virtualized-collections`, 1000 items each): the server renders the first window only, no library code
// runs before interaction, then the cold scroll starts the engine, a click selects, ArrowDown ×30 walks focus past
// the window edge (rows scroll in, focus is kept), Space selects. COLLECTION-VIRT-2: the same for ListBox sections,
// GridList, Menu and Tree (ListLayout; Tree over its flattened expanded rows).
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

/** The focused element's `data-key` is `key`. */
const focusOn = (page: Page, key: string) =>
  page
    .waitForFunction((key) => document.activeElement?.getAttribute("data-key") === key, key, { timeout: 5000 })
    .catch(async (e) => {
      throw new Error(`focus: expected ${key}, got ${await focusedKey(page)}: ${e}`);
    });

/** Cold wheel over `host` until the element of `selector` is attached (the engine started and rendered that window). */
async function coldScroll(page: Page, host: string, selector: string, seen: ReturnType<typeof watch>): Promise<void> {
  const el = (await page.$(host))!;
  // Below the fold: bring the host into the viewport (document scroll), else the wheel lands outside it.
  await el.scrollIntoViewIfNeeded();
  const rect = (await el.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.wheel(0, 3200);
  await page.waitForSelector(selector, { state: "attached", timeout: 5000 }).catch(async (e) => {
    throw new Error(JSON.stringify({ errors: seen.errors, top: await page.$eval(host, (el) => el.scrollTop) }) + e);
  });
  // The content takes no pointer events while scrolling (300 ms after the last scroll event).
  await page.waitForTimeout(350);
}

test("virtualized listbox sections: server window, per-section posinset, cold scroll, ArrowDown across sections, select", async () => {
  const page = await open();
  const seen = watch(page);
  const host = "#vsections";
  const options = await count(page, `${host} [role=option]`);
  assert.ok(options > 5 && options < 30, `first window only (${options} options)`);
  assert.equal(await count(page, `${host} [role=group]`), 1, "the first section");
  assert.equal((await page.textContent(`${host} [role=group] header`))?.trim(), "Group 1");
  assert.equal(await page.getAttribute(`${host} [data-key='g1-1']`, "aria-posinset"), "1");
  assert.equal(await page.getAttribute(`${host} [data-key='g1-1']`, "aria-setsize"), "50");
  // 20 sections of a 28px header + 50 x 32px rows.
  assert.ok((await page.$eval(host, (el) => el.scrollHeight)) >= 20 * (28 + 50 * 32));
  // 3200px: the end of section 2 (it starts at 1628).
  await coldScroll(page, host, `${host} [role=option][data-key='g2-50']`, seen);
  assert.equal(await count(page, `${host} [data-key='g1-1']`), 0, "the first window left the DOM");
  assert.ok(
    (await page.$$eval(`${host} header`, (els) => els.map((el) => el.textContent?.trim()))).includes("Group 2"),
    "the visible section's header renders",
  );
  await page.click(`${host} [role=option][data-key='g2-50']`);
  await untilText(page, "#vsections-value", "g2-50");
  await focusOn(page, "g2-50");
  // ArrowDown skips the next section's header (not an item); posinset restarts per section.
  await page.keyboard.press("ArrowDown");
  await focusOn(page, "g3-1");
  for (let i = 0; i < 29; i++) await page.keyboard.press("ArrowDown");
  await focusOn(page, "g3-30");
  assert.ok(await inView(page, host, `${host} [data-key='g3-30']`), "the focused option scrolled into view");
  assert.equal(await page.getAttribute(`${host} [data-key='g3-30']`, "aria-posinset"), "30");
  await page.keyboard.press("Space");
  await untilText(page, "#vsections-value", "g2-50,g3-30");
  await page.keyboard.press("End");
  await focusOn(page, "g20-50");
  await page.keyboard.press("Home");
  await focusOn(page, "g1-1");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("virtualized grid list: server window, cold scroll, click selects, ArrowDown ×30, Space, End / Home / PageDown", async () => {
  const page = await open();
  const seen = watch(page);
  const host = "#vgrid";
  assert.equal(await page.getAttribute(host, "role"), "grid");
  assert.equal(await page.getAttribute(host, "aria-rowcount"), "1000");
  const rows = await count(page, `${host} [role=row]`);
  assert.ok(rows > 5 && rows < 30, `first window only (${rows} rows)`);
  assert.equal(await page.getAttribute(`${host} [role=row][data-key='1']`, "aria-rowindex"), "1");
  await coldScroll(page, host, `${host} [role=row][data-key='101']`, seen);
  assert.equal(await count(page, `${host} [role=row][data-key='1']`), 0, "the first window left the DOM");
  assert.equal(await page.getAttribute(`${host} [role=row][data-key='101']`, "aria-rowindex"), "101");
  await page.click(`${host} [role=row][data-key='103']`);
  await untilText(page, "#vgrid-value", "103");
  await focusOn(page, "103");
  for (let i = 0; i < 30; i++) await page.keyboard.press("ArrowDown");
  await focusOn(page, "133");
  assert.ok(await inView(page, host, `${host} [data-key='133']`), "the focused row scrolled into view");
  await page.keyboard.press("Space");
  await untilText(page, "#vgrid-value", "103,133");
  await page.keyboard.press("End");
  await focusOn(page, "1000");
  await page.keyboard.press("Home");
  await focusOn(page, "1");
  assert.ok(await inView(page, host, `${host} [data-key='1']`));
  await page.keyboard.press("PageDown");
  await page.waitForFunction(() => Number(document.activeElement?.getAttribute("data-key")) >= 9, undefined, { timeout: 5000 });
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("virtualized menu: server window, posinset, cold scroll, click runs the action, ArrowDown ×30, Enter, End / Home", async () => {
  const page = await open();
  const seen = watch(page);
  const host = "#vmenu";
  const items = await count(page, `${host} [role=menuitem]`);
  assert.ok(items > 5 && items < 30, `first window only (${items} items)`);
  assert.equal(await page.getAttribute(`${host} [data-key='1']`, "aria-posinset"), "1");
  assert.equal(await page.getAttribute(`${host} [data-key='1']`, "aria-setsize"), "1000");
  await coldScroll(page, host, `${host} [role=menuitem][data-key='101']`, seen);
  assert.equal(await count(page, `${host} [role=menuitem][data-key='1']`), 0, "the first window left the DOM");
  await page.click(`${host} [role=menuitem][data-key='103']`);
  await untilText(page, "#vmenu-value", "103");
  // Keyboard from the clicked item (focus the menu item first: a standalone menu keeps pointer focus where it is).
  await page.focus(`${host} [data-key='103']`);
  await focusOn(page, "103");
  for (let i = 0; i < 30; i++) await page.keyboard.press("ArrowDown");
  await focusOn(page, "133");
  assert.ok(await inView(page, host, `${host} [data-key='133']`), "the focused item scrolled into view");
  await page.keyboard.press("Enter");
  await untilText(page, "#vmenu-value", "133");
  await page.keyboard.press("End");
  await focusOn(page, "1000");
  await page.keyboard.press("Home");
  await focusOn(page, "1");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("virtualized tree: server window, cold scroll, click selects, ArrowDown ×30, Space, End / Home, collapse", async () => {
  const page = await open();
  const seen = watch(page);
  const host = "#vtree";
  assert.equal(await page.getAttribute(host, "role"), "treegrid");
  const rows = await count(page, `${host} [role=row]`);
  assert.ok(rows > 5 && rows < 30, `first window only (${rows} rows)`);
  assert.equal(await page.getAttribute(`${host} [role=row][data-key='f1-1']`, "aria-level"), "2");
  // 1000 flattened rows (100 expanded folders of 9 files) of 32px.
  assert.ok((await page.$eval(host, (el) => el.scrollHeight)) >= 1000 * 32);
  // 3200px = row 100: folder 11.
  await coldScroll(page, host, `${host} [role=row][data-key='f11']`, seen);
  assert.equal(await count(page, `${host} [role=row][data-key='f1']`), 0, "the first window left the DOM");
  await page.click(`${host} [role=row][data-key='f11-2']`);
  await untilText(page, "#vtree-value", "f11-2");
  await focusOn(page, "f11-2");
  // Row 102 + 30 = row 132: folder 14's second file.
  for (let i = 0; i < 30; i++) await page.keyboard.press("ArrowDown");
  await focusOn(page, "f14-2");
  assert.ok(await inView(page, host, `${host} [data-key='f14-2']`), "the focused row scrolled into view");
  await page.keyboard.press("Space");
  await untilText(page, "#vtree-value", "f11-2,f14-2");
  await page.keyboard.press("End");
  await focusOn(page, "f100-9");
  await page.keyboard.press("Home");
  await focusOn(page, "f1");
  // ArrowLeft collapses the focused folder: its files leave the flattened rows, the next folder follows it.
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => document.querySelector("#vtree [data-key='f1']")?.getAttribute("aria-expanded") === "false", undefined, { timeout: 5000 });
  assert.equal(await count(page, `${host} [role=row][data-key='f1-1']`), 0);
  await page.keyboard.press("ArrowDown");
  await focusOn(page, "f2");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
