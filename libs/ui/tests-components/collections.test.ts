// P3-COLLECTIONS — resumed story app (`/collections`): Breadcrumbs SSR markup + CSS, resumed `onPress`; Toolbar SSR classes,
// upstream "keyboard arrow navigation between toolbar items" (Tab then ArrowRight moves focus), live `isAttached` in place;
// ListBox SSR selection + resumed click toggles; TagGroup resumed remove button; Dropdown (upstream dropdown.browser.test: opens,
// items, Escape restores focus to the trigger), resumed `onAction`, section selection, submenu. Pagination SSR classes / CSS,
// resumed page links + Previous / Next (live `isActive` / `isDisabled`, nodes kept), keyboard focus ring. Shorthand forms
// (identity T22): Pagination `total` (resumed links re-render the range, ellipses), TagGroup `label` + `items`, Breadcrumbs `items`.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage();
  try {
    await body(page);
  } finally {
    await page.close();
  }
}

test("breadcrumbs: SSR markup, separators, current page; resumed onPress", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/collections");
    assert.equal(await page.getAttribute("#bc", "class"), "breadcrumbs");
    assert.equal(await page.$$eval("#bc [data-slot=breadcrumbs-separator]", (els) => els.length), 2);
    assert.equal(await page.$eval("#bc li:last-child [role=link], #bc li:last-child a", (el) => el.getAttribute("aria-current")), "page");
    assert.equal(await page.$eval("#bc", (el) => getComputedStyle(el).display), "flex");
    await page.click("#bc a[href='#home']");
    await page.waitForFunction(() => document.querySelector("#bc-pressed")?.textContent === "1");
    assert.deepEqual(seen.errors, []);
  }));

test("toolbar (upstream): Tab enters, ArrowRight moves focus; live isAttached keeps the node", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/collections");
    assert.match((await page.getAttribute("#tb", "class")) ?? "", /^toolbar toolbar--horizontal/);
    await page.focus("#tb-attach");
    await page.keyboard.press("Shift+Tab");
    await page.waitForFunction(() => document.activeElement?.closest("#tb") !== null);
    await page.focus("#tb-undo");
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.activeElement?.id === "tb-redo");
    const tb = await page.$("#tb");
    await page.click("#tb-attach");
    await page.waitForFunction(() => document.querySelector("#tb")!.className.includes("toolbar--attached"));
    await page.click("#tb-attach");
    await page.waitForFunction(() => !document.querySelector("#tb")!.className.includes("toolbar--attached"));
    await page.click("#tb-attach");
    await page.waitForFunction(() => document.querySelector("#tb")!.className.includes("toolbar--attached"));
    assert.ok(await page.evaluate((el) => el === document.querySelector("#tb"), tb));
    assert.deepEqual(seen.errors, []);
  }));

test("list-box: SSR selected option + indicator; resumed click selects, signal echoes", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/collections");
    assert.match((await page.getAttribute("#lb", "class")) ?? "", /list-box/);
    assert.equal(await page.getAttribute("#lb [data-key=apple]", "aria-selected"), "true");
    assert.equal(await page.$$eval("#lb [data-slot=list-box-item-indicator]", (els) => els.length), 3);
    await page.click("#lb [data-key=cherry]");
    await page.waitForFunction(() => document.querySelector("#lb-sel")?.textContent === "apple,cherry");
    assert.equal(await page.getAttribute("#lb [data-key=cherry]", "aria-selected"), "true");
    assert.equal(await page.getAttribute("#lb [data-key=cherry] [data-slot=list-box-item-indicator]", "data-visible"), "true");
    assert.deepEqual(seen.errors, []);
  }));

test("tag-group: SSR tags + remove buttons; resumed remove fires onRemove", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/collections");
    assert.match((await page.getAttribute("#tg", "class")) ?? "", /tag-group/);
    assert.equal(await page.$$eval("#tg [data-slot=tag-remove-button]", (els) => els.length), 3);
    await page.click("#tg [data-key=travel] [data-slot=tag-remove-button]");
    await page.waitForFunction(() => document.querySelector("#tg-count")?.textContent === "2");
    assert.deepEqual(seen.errors, []);
  }));

test("dropdown (upstream): opens the menu, shows items, Escape restores focus to the trigger", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/collections");
    assert.equal(await page.getAttribute("#dd-trigger", "class"), "dropdown__trigger");
    assert.equal(await page.$("[role=menu]"), null);
    await page.click("#dd-trigger");
    await page.waitForSelector("#dd[role=menu]");
    assert.equal(await page.getAttribute("#dd", "class"), "dropdown__menu");
    assert.match((await page.getAttribute("[data-slot=dropdown-popover]", "class")) ?? "", /dropdown__popover/);
    assert.ok(await page.$("#dd [data-key=new-file]"));
    // Folded form: one popover, string item = Label, shortcut = Kbd with abbreviations.
    assert.equal(await page.$$eval("[data-slot=dropdown-popover]", (els) => els.length), 1);
    assert.equal(await page.textContent("#dd [data-key=new-file] [data-slot=label]"), "New file");
    assert.equal(await page.getAttribute("#dd [data-key=new-file] .menu-item__shortcut abbr", "title"), "Command");
    assert.equal(await page.$eval("[data-slot=dropdown-popover]", (el) => getComputedStyle(el).borderRadius !== "0px"), true);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("#dd"));
    await page.waitForFunction(() => document.activeElement?.id === "dd-trigger");
    assert.deepEqual(seen.errors, []);
  }));

test("dropdown: resumed onAction, section selection indicators, submenu", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/collections");
    await page.click("#dd-trigger");
    await page.waitForSelector("#dd");
    assert.equal(await page.getAttribute("#dd [data-key=left] [data-slot=menu-item-indicator]", "data-visible"), "true");
    await page.click("#dd [data-key=right]");
    // Single selection closes the menu (RAC `shouldCloseOnSelect`); reopen to read the indicators.
    await page.waitForFunction(() => !document.querySelector("#dd"));
    await page.click("#dd-trigger");
    await page.waitForSelector("#dd");
    assert.equal(await page.getAttribute("#dd [data-key=right] [data-slot=menu-item-indicator]", "data-visible"), "true");
    assert.equal(await page.getAttribute("#dd [data-key=left] [data-slot=menu-item-indicator]", "data-visible"), null);
    await page.hover("#dd [data-key=share]");
    await page.waitForSelector("[role=menu][aria-label=Share] [data-key=mail]");
    assert.equal(await page.$$eval("[data-slot=dropdown-popover]", (els) => els.length), 2);
    assert.ok(await page.$("#dd [data-key=share] [data-slot=submenu-indicator] svg"));
    await page.click("[role=menu][aria-label=Share] [data-key=mail]");
    await page.waitForFunction(() => document.querySelector("#dd-action")?.textContent === "mail");
    await page.waitForFunction(() => !document.querySelector("#dd"));
    await page.click("#dd-trigger");
    await page.click("#dd [data-key=new-file]");
    await page.waitForFunction(() => document.querySelector("#dd-action")?.textContent === "new-file");
    assert.deepEqual(seen.errors, []);
  }));

test("pagination: SSR classes + CSS; resumed links / Previous / Next follow the page, nodes kept", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/collections");
    assert.equal(await page.getAttribute("#pg", "class"), "pagination pagination--md justify-center");
    assert.equal(await page.getAttribute("#pg", "aria-label"), "pagination");
    assert.equal(await page.getAttribute("#pg-1", "aria-current"), "page");
    assert.equal(await page.getAttribute("#pg-1", "data-active"), "true");
    assert.equal(await page.$eval("#pg-prev", (el) => (el as HTMLButtonElement).disabled), true);
    assert.match((await page.getAttribute("#pg-prev", "class")) ?? "", /pagination__link pagination__link--nav/);
    // HeroUI CSS: round ghost links, active link on the default surface.
    assert.notEqual(await page.$eval("#pg-1", (el) => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
    assert.equal(await page.$eval("#pg-2", (el) => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
    await page.evaluate(() => ((document.querySelector("#pg-next") as HTMLElement & { mark?: number }).mark = 1));
    await page.click("#pg-2");
    await page.waitForFunction(() => document.querySelector("#pg-page")?.textContent === "2");
    await page.waitForFunction(() => document.querySelector("#pg-2")?.getAttribute("aria-current") === "page");
    assert.equal(await page.getAttribute("#pg-1", "aria-current"), null);
    assert.equal(await page.$eval("#pg-prev", (el) => (el as HTMLButtonElement).disabled), false);
    await page.click("#pg-next");
    await page.waitForFunction(() => document.querySelector("#pg-page")?.textContent === "3");
    await page.waitForFunction(() => (document.querySelector("#pg-next") as HTMLButtonElement).disabled);
    assert.equal(await page.getAttribute("#pg-3", "data-active"), "true");
    assert.equal(await page.evaluate(() => (document.querySelector("#pg-next") as HTMLElement & { mark?: number }).mark), 1);
    await page.click("#pg-prev");
    await page.waitForFunction(() => document.querySelector("#pg-page")?.textContent === "2");
    // Keyboard: Tab onto a link → focus-visible ring attribute.
    await page.focus("#pg-1");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "pg-2");
    assert.equal(await page.getAttribute("#pg-2", "data-focus-visible"), "true");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#pg-page")?.textContent === "2");
    assert.deepEqual(seen.errors, []);
  }));

test("shorthand (T22): resumed Pagination total + Signal / defaultPage / accessor page, TagGroup label + items, Breadcrumbs items", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/collections");
    const labels = () => page.$$eval("#pg-auto [data-slot=pagination-item]", (els) => els.map((e) => e.textContent!.trim()));
    assert.deepEqual(await labels(), ["Previous", "1", "2", "3", "4", "5", "\u2026", "12", "Next"]);
    await page.click("#pg-auto [data-slot=pagination-link] >> text=5");
    await page.waitForFunction(() => document.querySelector("#pg-auto-page")?.textContent === "5");
    assert.deepEqual(await labels(), ["Previous", "1", "\u2026", "4", "5", "6", "\u2026", "12", "Next"]);
    assert.equal(await page.$eval("#pg-auto [aria-current=page]", (el) => el.textContent), "5");
    await page.click("#pg-auto [data-slot=pagination-next]");
    await page.waitForFunction(() => document.querySelector("#pg-auto-page")?.textContent === "6");
    // Uncontrolled defaultPage: server marks page 3, a resumed press moves it and reports onPageChange.
    assert.equal(await page.$eval("#pg-default [aria-current=page]", (el) => el.textContent), "3");
    await page.click("#pg-default [data-slot=pagination-next]");
    await page.waitForFunction(() => document.querySelector("#pg-default-page")?.textContent === "4");
    assert.equal(await page.$eval("#pg-default [aria-current=page]", (el) => el.textContent), "4");
    // Accessor page: follows an outside write, presses go through onPageChange.
    assert.equal(await page.$eval("#pg-acc [aria-current=page]", (el) => el.textContent), "2");
    await page.click("#pg-acc-last");
    await page.waitForFunction(() => document.querySelector("#pg-acc [aria-current=page]")?.textContent === "6");
    await page.click("#pg-acc [data-slot=pagination-previous]");
    await page.waitForFunction(() => document.querySelector("#pg-acc-page")?.textContent === "5");
    assert.equal(await page.$eval("#pg-acc [aria-current=page]", (el) => el.textContent), "5");
    // TagGroup: Label names the grid, list classes, resumed selection.
    const grid = "#tg-auto [role=grid]";
    assert.match((await page.getAttribute(grid, "class")) ?? "", /tag-group__list/);
    const labelId = ((await page.getAttribute(grid, "aria-labelledby")) ?? "").split(" ")[0]!;
    assert.equal(await page.$eval(`[id="${labelId}"]`, (el) => el.textContent), "Amenities");
    await page.click("#tg-auto [role=row]:has-text('Pool')");
    await page.waitForFunction(() => document.querySelector("#tg-auto-sel")?.textContent === "pool");
    // Breadcrumbs items: links, separators, current page.
    assert.equal(await page.$$eval("#bc-auto [data-slot=breadcrumbs-separator]", (els) => els.length), 2);
    assert.equal(await page.getAttribute("#bc-auto a[href='#docs']", "class"), "link breadcrumbs__link");
    assert.equal(await page.$eval("#bc-auto li:last-child [data-slot=link]", (el) => el.getAttribute("aria-current")), "page");
    assert.deepEqual(seen.errors, []);
  }));
