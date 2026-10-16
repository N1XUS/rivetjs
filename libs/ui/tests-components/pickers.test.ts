// P3-COLLECTIONS — resumed story app (`/pickers`): Select (upstream select.browser.test: opens the listbox, shows options, Escape
// restores focus to the trigger; selecting with the mouse leaves no trigger focus ring, with the keyboard rings it; clear button
// click clears without opening and focuses the trigger; Backspace shortcut), SSR markup + CSS, resumed onChange / onClear,
// multiple selection with a value signal; ComboBox (SSR markup + CSS, trigger opens with menuTrigger "focus", typing filters,
// option press fills the input + resumed onChange, Escape closes); Autocomplete (SSR + CSS, trigger click opens with the search field
// focused, typing filters, pick → resumed onChange, clear button; upstream autocomplete.browser test: removing a tag off the glyph
// removes it on the first press and does not open the popover).
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
    await page.goto(s.origin + "/pickers");
    await body(page);
  } finally {
    await page.close();
  }
}

const valueText = (page: Page, id: string) => page.$eval(`[data-testid=${id}] [data-slot=select-value]`, (el) => el.textContent!.trim());

test("select: SSR markup + CSS", () =>
  onPage(async (page) => {
    assert.equal(await page.getAttribute("[data-testid=sel]", "data-slot"), "select");
    assert.match((await page.getAttribute("[data-testid=sel]", "class")) ?? "", /^select select--primary/);
    assert.equal(await page.getAttribute("#sel-trigger", "class"), "select__trigger");
    assert.equal(await valueText(page, "sel"), "California");
    assert.ok(await page.$("[data-testid=sel] [data-slot=select-clear-button] svg"));
    assert.ok(await page.$("[data-testid=sel] [data-slot=select-default-indicator]"));
    assert.equal(await page.$eval("#sel-trigger", (el) => getComputedStyle(el).minHeight), "36px");
    // `.select__value` hides the ListBox item indicator rendered with the selected item's content.
    assert.equal(
      await page.$eval("[data-testid=sel] [data-slot=select-value] [data-slot=list-box-item-indicator]", (el) => getComputedStyle(el).display),
      "none",
    );
  }));

test("select (upstream): opens the listbox, shows options, Escape restores focus to the trigger", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.click("#sel-trigger");
    await page.waitForSelector("[role=listbox]");
    assert.equal(await page.$$eval("[role=option]", (els) => els.map((e) => e.textContent!.trim()).join(",")), "Florida,California,Texas");
    assert.match((await page.getAttribute("[data-slot=select-popover]", "class")) ?? "", /select__popover/);
    assert.equal(await page.getAttribute("[data-testid=sel] [data-slot=select-default-indicator]", "data-open"), "true");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("[role=listbox]"));
    await page.waitForFunction(() => document.activeElement?.id === "sel-trigger");
    assert.deepEqual(seen.errors, []);
  }));

test("select (upstream): mouse selection leaves no trigger ring; keyboard selection rings it; resumed onChange", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.click("#sel-trigger");
    await page.waitForSelector("[role=listbox]");
    await page.click("[role=option]:has-text('Texas')");
    await page.waitForFunction(() => !document.querySelector("[role=listbox]"));
    await page.waitForFunction(() => document.querySelector("#sel-value")?.textContent === "texas");
    assert.equal(await valueText(page, "sel"), "Texas");
    await page.waitForFunction(() => document.activeElement?.id === "sel-trigger");
    assert.equal(await page.getAttribute("#sel-trigger", "data-focus-visible"), null);
    await page.click("#sel-trigger");
    await page.waitForSelector("[role=listbox]");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => !document.querySelector("[role=listbox]"));
    await page.waitForFunction(() => document.querySelector("#sel-value")?.textContent === "california");
    await page.waitForFunction(() => document.querySelector("#sel-trigger")?.getAttribute("data-focus-visible") === "true");
    assert.deepEqual(seen.errors, []);
  }));

test("select clear button (upstream): click clears, listbox stays closed, trigger focused; Backspace shortcut", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.click("[data-testid=sel] [data-slot=select-clear-button]");
    await page.waitForFunction(() => document.querySelector("#sel-cleared")?.textContent === "1");
    assert.equal(await valueText(page, "sel"), "Select one");
    assert.equal(await page.$("[role=listbox]"), null);
    assert.equal(await page.getAttribute("[data-testid=sel] [data-slot=select-clear-button]", "data-empty"), "true");
    await page.waitForFunction(() => document.activeElement?.id === "sel-trigger");
    // Pick again, then clear with Backspace on the focused trigger.
    await page.click("#sel-trigger");
    await page.waitForSelector("[role=listbox]");
    await page.click("[role=option]:has-text('Florida')");
    await page.waitForFunction(() => document.querySelector("#sel-value")?.textContent === "florida");
    await page.waitForFunction(() => document.activeElement?.id === "sel-trigger");
    await page.keyboard.press("Backspace");
    await page.waitForFunction(() => document.querySelector("#sel-cleared")?.textContent === "2");
    assert.equal(await valueText(page, "sel"), "Select one");
    assert.equal(await page.$("[role=listbox]"), null);
    assert.deepEqual(seen.errors, []);
  }));

test("select: multiple selection with a value signal (resumed)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    assert.equal(await valueText(page, "selm"), "Cat");
    await page.click("#selm-trigger");
    await page.waitForSelector("[role=listbox][aria-multiselectable=true]");
    await page.click("[role=option]:has-text('Dog')");
    await page.waitForFunction(() => document.querySelector("#selm-value")?.textContent === "cat,dog");
    assert.ok(await page.$("[role=listbox]"));
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("[role=listbox]"));
    assert.equal(await valueText(page, "selm"), "Cat and Dog");
    assert.deepEqual(seen.errors, []);
  }));

test("combo-box: SSR markup + CSS", () =>
  onPage(async (page) => {
    assert.equal(await page.getAttribute("[data-testid=cb]", "data-slot"), "combo-box");
    assert.match((await page.getAttribute("[data-testid=cb]", "class")) ?? "", /^combo-box/);
    assert.equal(await page.getAttribute("[data-testid=cb] [data-slot=combo-box-input-group]", "class"), "combo-box__input-group");
    assert.equal(await page.getAttribute("#cb-input", "role"), "combobox");
    assert.equal(await page.getAttribute("#cb-input", "class"), "input input--primary");
    assert.equal(await page.getAttribute("#cb-trigger", "class"), "combo-box__trigger");
    assert.ok(await page.$("#cb-trigger [data-slot=combo-box-trigger-default-icon]"));
    // `.combo-box__trigger` sits inside the input (absolute, end-0); the input gets end padding for it.
    assert.equal(await page.$eval("#cb-trigger", (el) => getComputedStyle(el).position), "absolute");
    assert.equal(await page.$eval("#cb-input", (el) => getComputedStyle(el).paddingInlineEnd), "28px");
  }));

test("combo-box: trigger opens (menuTrigger focus), typing filters, option fills the input + resumed onChange", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.click("#cb-trigger");
    await page.waitForSelector("[role=listbox]");
    await page.waitForFunction(() => document.activeElement?.id === "cb-input");
    assert.equal(await page.getAttribute("#cb-trigger", "data-open"), "true");
    assert.equal(await page.$$eval("[role=option]", (els) => els.map((e) => e.textContent!.trim()).join(",")), "Cat,Dog,Panda");
    assert.match((await page.getAttribute("[data-slot=combo-box-popover]", "class")) ?? "", /combo-box__popover/);
    await page.keyboard.type("pa");
    await page.waitForFunction(() => document.querySelectorAll("[role=option]").length === 1);
    await page.click("[role=option]:has-text('Panda')");
    await page.waitForFunction(() => !document.querySelector("[role=listbox]"));
    await page.waitForFunction(() => document.querySelector("#cb-value")?.textContent === "panda");
    assert.equal(await page.inputValue("#cb-input"), "Panda");
    assert.equal(await page.getAttribute("#cb-trigger", "data-open"), null);
    assert.deepEqual(seen.errors, []);
  }));

test("combo-box: focusing the input opens the menu; Escape closes it", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.click("#cb-input");
    await page.waitForSelector("[role=listbox]");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("[role=listbox]"));
    await page.waitForFunction(() => document.activeElement?.id === "cb-input");
    assert.deepEqual(seen.errors, []);
  }));

test("autocomplete: SSR markup + CSS", () =>
  onPage(async (page) => {
    assert.equal(await page.getAttribute("[data-testid=ac]", "data-slot"), "autocomplete");
    assert.match((await page.getAttribute("[data-testid=ac]", "class")) ?? "", /^autocomplete autocomplete--primary/);
    assert.equal(await page.getAttribute("[data-testid=ac] [data-slot=autocomplete-trigger]", "class"), "autocomplete__trigger");
    assert.equal(await page.$eval("[data-testid=ac] [data-slot=autocomplete-value]", (el) => el.textContent!.trim()), "Select an animal");
    assert.equal(await page.getAttribute("[data-testid=ac] [data-slot=autocomplete-clear-button]", "data-empty"), "true");
    assert.equal(await page.$eval("[data-testid=ac] [data-slot=autocomplete-trigger]", (el) => getComputedStyle(el).minHeight), "36px");
  }));

test("autocomplete: trigger click opens with the search field focused, typing filters, pick → resumed onChange, clear", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.click("[data-testid=ac] [data-slot=autocomplete-value]");
    await page.waitForSelector("[role=listbox]");
    await page.waitForFunction(() => (document.activeElement as HTMLInputElement | null)?.type === "search");
    assert.match((await page.getAttribute("[data-slot=autocomplete-popover]", "class")) ?? "", /autocomplete__popover/);
    // The popover is as wide as the trigger group (`--trigger-width` from the cdk positioning; layout widths: the enter animation scales).
    const [tw, pw] = await page.evaluate(() => [
      (document.querySelector("[data-testid=ac] [data-slot=autocomplete-trigger]") as HTMLElement).offsetWidth,
      (document.querySelector("[data-slot=autocomplete-popover]") as HTMLElement).offsetWidth,
    ]);
    assert.ok(pw >= tw - 1, `popover ${pw} < trigger ${tw}`);
    await page.keyboard.type("pa");
    await page.waitForFunction(() => document.querySelectorAll("[role=option]").length === 1);
    await page.click("[role=option]:has-text('Panda')");
    await page.waitForFunction(() => !document.querySelector("[role=listbox]"));
    await page.waitForFunction(() => document.querySelector("#ac-value")?.textContent === "panda");
    assert.match(await page.$eval("[data-testid=ac] [data-slot=autocomplete-value]", (el) => el.textContent!), /Panda/);
    await page.click("[data-testid=ac] [data-slot=autocomplete-clear-button]");
    await page.waitForFunction(() => document.querySelector("#ac-value")?.textContent === "null");
    assert.equal(await page.$("[role=listbox]"), null);
    assert.deepEqual(seen.errors, []);
  }));

test("autocomplete (upstream browser): removes the tag on the first press landing off the glyph, popover stays closed", () =>
  onPage(async (page) => {
    const seen = watch(page);
    const remove = page.locator("[data-testid=acm] [role=row]:has-text('Dog') button");
    const box = (await remove.boundingBox())!;
    // Offset from the glyph centre that a finger routinely lands on, inside the 24px target.
    await page.mouse.click(box.x + box.width / 2 - 11, box.y + box.height / 2);
    await page.waitForFunction(() => document.querySelector("#acm-value")?.textContent === "cat,panda");
    assert.equal(await page.$$eval("[data-testid=acm] [role=row]", (els) => els.map((e) => e.textContent!.trim()).join(",")), "Cat,Panda");
    assert.equal(await page.$("[role=listbox]"), null);
    assert.deepEqual(seen.errors, []);
  }));

test("shorthand (T22): resumed ComboBox label + Items and Autocomplete label + items pick into their value signals", () =>
  onPage(async (page) => {
    const seen = watch(page);
    const cb = "[data-testid=cb-auto]";
    assert.equal(await page.$eval(`${cb} [data-slot=label]`, (el) => el.textContent), "Pet");
    await page.fill(`${cb} input`, "d");
    await page.waitForSelector("[data-slot=combo-box-popover] [role=option]");
    assert.deepEqual(await page.$$eval("[data-slot=combo-box-popover] [role=option]", (els) => els.map((e) => e.textContent!.trim())), ["Dog"]);
    await page.click("[data-slot=combo-box-popover] [role=option]:has-text('Dog')");
    await page.waitForFunction(() => document.querySelector("#cb-auto-value")?.textContent === "dog");
    assert.equal(await page.$eval(`${cb} input`, (el) => (el as HTMLInputElement).value), "Dog");
    const ac = "[data-testid=ac-auto]";
    await page.click(`${ac} [data-slot=autocomplete-trigger]`);
    await page.waitForSelector("[data-slot=autocomplete-popover] [role=option]");
    await page.keyboard.type("pan");
    await page.waitForFunction(() => document.querySelectorAll("[data-slot=autocomplete-popover] [role=option]").length === 1);
    await page.click("[data-slot=autocomplete-popover] [role=option]:has-text('Panda')");
    await page.waitForFunction(() => document.querySelector("#ac-auto-value")?.textContent === "panda");
    assert.equal(await page.$eval(`${ac} [data-slot=autocomplete-value]`, (el) => el.textContent), "Panda");
    assert.deepEqual(seen.errors, []);
  }));
