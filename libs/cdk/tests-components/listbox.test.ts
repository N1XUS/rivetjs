// ListBox: behavioural cases ported from react-aria-components test/ListBox.test.js (Apache-2.0,
// © Adobe), run against the resumed production story build.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, focused, libraryScripts, type Stories, type Watch } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const text = (page: Page, sel: string) => page.textContent(sel);
const until = (page: Page, sel: string, value: string) =>
  page
    .waitForFunction(([sel, value]) => document.querySelector(sel!)?.textContent === value, [sel, value] as const, { timeout: 5000 })
    .catch(async () => {
      assert.equal(await text(page, sel), value);
    });
const selected = (page: Page, list: string) => page.$$eval(`#${list} [role=option][aria-selected=true]`, (els) => els.map((el) => el.getAttribute("data-key")));

async function open(path = "/listbox", options: { hasTouch?: boolean } = {}): Promise<{ page: Page; seen: Watch }> {
  const context = await s.browser.newContext(options);
  const page = await context.newPage();
  const seen = watch(page);
  await page.goto(s.origin + path);
  return { page, seen };
}

test("listbox: server ARIA, cold arrow key held (no scroll), roving focus, selection", async () => {
  const { page, seen } = await open();
  assert.equal(await page.getAttribute("#fruit", "role"), "listbox");
  assert.equal(await page.getAttribute("#fruit-option-banana", "aria-selected"), "true");
  assert.equal(await page.getAttribute("#fruit-option-banana", "data-selected"), "true");
  // RA useSelectableCollection: no focused key yet → the listbox is the tab stop, options are -1.
  assert.equal(await page.getAttribute("#fruit", "tabindex"), "0");
  assert.equal(await page.getAttribute("#fruit-option-banana", "tabindex"), "-1");
  assert.equal(await page.getAttribute("#fruit-option-apple", "tabindex"), "-1");
  assert.equal(await page.getAttribute("#fruit-option-cherry", "aria-disabled"), "true");
  assert.equal(await page.getAttribute("#fruit", "aria-orientation"), "vertical");
  assert.equal(await page.getAttribute("#fruit", "data-layout"), "stack");
  assert.deepEqual(libraryScripts(seen), [], "no library code before interaction");
  await page.focus("#fruit-option-banana");
  const before = await page.evaluate(() => scrollY);
  await page.keyboard.press("ArrowDown");
  // Cherry is disabled: skipped.
  await page.waitForFunction(() => document.activeElement?.id === "fruit-option-date");
  assert.equal(await page.evaluate(() => scrollY), before, "cold ArrowDown did not scroll");
  await page.waitForFunction(() => document.querySelector("#fruit-option-date")?.getAttribute("tabindex") === "0", undefined, { timeout: 5000 });
  assert.equal(await page.getAttribute("#fruit-option-banana", "tabindex"), "-1");
  assert.equal(await page.getAttribute("#fruit-option-date", "data-focused"), "true");
  await page.keyboard.press("Space");
  await until(page, "#fruit-value", "Picked: date");
  assert.equal(await page.getAttribute("#fruit-option-date", "aria-selected"), "true");
  assert.equal(await page.getAttribute("#fruit-option-banana", "aria-selected"), "false");
  await page.keyboard.press("Home");
  assert.equal((await focused(page)).key, "apple");
  await page.keyboard.press("End");
  assert.equal((await focused(page)).key, "elderberry");
  // Typeahead.
  await page.keyboard.press("b");
  assert.equal((await focused(page)).key, "banana");
  // Multiple: click toggles, Shift+Arrow extends.
  await page.click("#many-option-apple");
  await page.keyboard.press("Shift+ArrowDown");
  await until(page, "#many-value", "Picked: apple, banana");
  assert.equal(await page.getAttribute("#many", "aria-multiselectable"), "true");
  assert.deepEqual(seen.errors, []);
  await page.context().close();
});

test("listbox: sections (group + presentation header), description slots", async () => {
  const { page, seen } = await open();
  const groups = await page.$$eval("#grouped [role=group]", (els) =>
    els.map((el) => ({ labelledby: el.getAttribute("aria-labelledby"), header: document.getElementById(el.getAttribute("aria-labelledby")!)?.textContent })),
  );
  assert.deepEqual(
    groups.map((g) => g.header),
    ["Fruit", "Vegetables"],
  );
  assert.equal(await page.getAttribute(`#${groups[0]!.labelledby}`, "role"), "presentation");
  assert.equal(await page.getAttribute("#grouped-option-plum", "aria-labelledby"), "grouped-option-plum-label");
  assert.equal(await page.getAttribute("#grouped-option-plum", "aria-describedby"), "grouped-option-plum-description");
  assert.equal(await text(page, "#grouped-option-plum-description"), "Stone fruit");
  // Keyboard crosses section boundaries; Shift extends the range across them.
  await page.click("#grouped-option-plum");
  await page.keyboard.press("Shift+ArrowDown");
  await until(page, "#grouped-value", "Picked: leek, plum");
  assert.equal((await focused(page)).key, "leek");
  assert.deepEqual(seen.errors, []);
  await page.context().close();
});

test("listbox: numeric keys stay numbers; falsy key 0 (replace, keyboard and mouse)", async () => {
  const { page } = await open();
  await page.click("#nums-option-3");
  await until(page, "#nums-value", "Picked: 3 (number)");
  // RAC "should deselect item 0 when navigating back in replace selection mode".
  await page.click("#zero-option-0");
  await until(page, "#zero-value", "Picked: 0");
  await page.keyboard.press("ArrowDown");
  await until(page, "#zero-value", "Picked: 1");
  await page.keyboard.press("ArrowUp");
  await until(page, "#zero-value", "Picked: 0");
  // "starting selection at item 0 and extending to item 2".
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("Shift+ArrowDown");
  await until(page, "#zero-value", "Picked: 0, 1, 2");
  // Mouse: click 0, click 1 replaces; Shift+click extends from 0.
  await page.click("#zero-option-0");
  await until(page, "#zero-value", "Picked: 0");
  await page.click("#zero-option-1");
  await until(page, "#zero-value", "Picked: 1");
  await page.click("#zero-option-0");
  await page.click("#zero-option-2", { modifiers: ["Shift"] });
  await until(page, "#zero-value", "Picked: 0, 1, 2");
  await page.context().close();
});

test("listbox: selectionBehavior=replace, single (mouse and keyboard)", async () => {
  const { page } = await open();
  // Mouse: one onSelectionChange per press; pressing the selected item again deselects (single).
  await page.click("#single-option-kangaroo");
  await until(page, "#single-value", "Picked: kangaroo; calls: 1");
  await page.click("#single-option-dog");
  await until(page, "#single-value", "Picked: dog; calls: 2");
  await page.click("#single-option-dog", { modifiers: ["ControlOrMeta"] });
  await until(page, "#single-value", "Picked: ; calls: 3");
  await page.context().close();
  // Keyboard: tabbing in selects the focused item (selection follows focus), arrows replace.
  const { page: kb } = await open();
  await kb.focus("#single-before");
  await kb.keyboard.press("Tab");
  await until(kb, "#single-value", "Picked: cat; calls: 1");
  await kb.keyboard.press("ArrowDown");
  await kb.keyboard.press("ArrowDown");
  await until(kb, "#single-value", "Picked: kangaroo; calls: 3");
  await kb.keyboard.press("ArrowUp");
  await until(kb, "#single-value", "Picked: dog; calls: 4");
  await kb.context().close();
});

test("listbox: selectionBehavior=replace, multiple: modifiers toggle, plain press replaces, double click acts", async () => {
  const { page } = await open();
  await page.click("#replace-option-date");
  await until(page, "#replace-value", "Picked: date; action: none");
  await page.click("#replace-option-banana", { modifiers: ["ControlOrMeta"] });
  await until(page, "#replace-value", "Picked: banana, date; action: none");
  // With a modifier the same row deselects.
  await page.click("#replace-option-banana", { modifiers: ["ControlOrMeta"] });
  await until(page, "#replace-value", "Picked: date; action: none");
  // Without modifier: replace, and pressing the selected row again keeps it.
  await page.click("#replace-option-apple");
  await until(page, "#replace-value", "Picked: apple; action: none");
  await page.click("#replace-option-apple");
  await until(page, "#replace-value", "Picked: apple; action: none");
  // Double click triggers onAction (RAC "should trigger onAction on double click").
  await page.dblclick("#replace-option-elderberry");
  await until(page, "#replace-value", "Picked: elderberry; action: elderberry");
  // Keyboard: arrows move the selection, Shift extends, Mod+Arrow moves focus only, Space toggles.
  await page.keyboard.press("ArrowUp");
  await until(page, "#replace-value", "Picked: date; action: elderberry");
  await page.keyboard.press("Shift+ArrowUp");
  await until(page, "#replace-value", "Picked: banana, date; action: elderberry");
  await page.keyboard.press("Home");
  await until(page, "#replace-value", "Picked: apple; action: elderberry");
  await page.keyboard.press("End");
  await until(page, "#replace-value", "Picked: elderberry; action: elderberry");
  // Enter performs the action.
  await page.keyboard.press("Enter");
  await until(page, "#replace-value", "Picked: elderberry; action: elderberry");
  await page.context().close();
});

test("listbox: touch long press selects when onAction and selection coexist", async () => {
  const { page } = await open("/listbox", { hasTouch: true });
  const cdp = await page.context().newCDPSession(page);
  const centre = async (sel: string) => {
    const box = (await page.locator(sel).boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const touch = async (sel: string, hold: number) => {
    const point = await centre(sel);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await page.waitForTimeout(hold);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  await page.locator("#touch").scrollIntoViewIfNeeded();
  await touch("#touch-option-cat", 50);
  await until(page, "#touch-value", "Picked: ; actions: 1");
  await touch("#touch-option-cat", 800);
  await until(page, "#touch-value", "Picked: cat; actions: 1");
  // Once selecting, a tap toggles.
  await touch("#touch-option-dog", 50);
  await until(page, "#touch-value", "Picked: cat, dog; actions: 1");
  await page.context().close();
});

test("listbox: empty state, horizontal orientation, grid layout", async () => {
  const { page, seen } = await open();
  assert.equal(await page.getAttribute("#empty", "data-empty"), "true");
  assert.equal(await page.textContent("#empty [role=option]"), "No results");
  // Horizontal: ArrowRight / ArrowLeft move.
  assert.equal(await page.getAttribute("#horiz", "aria-orientation"), "horizontal");
  await page.focus("#horiz-option-cat");
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.activeElement?.id === "horiz-option-dog");
  await page.keyboard.press("ArrowRight");
  assert.equal((await focused(page)).key, "kangaroo");
  await page.keyboard.press("ArrowLeft");
  assert.equal((await focused(page)).key, "dog");
  // Grid (3 columns): ArrowDown moves a row, ArrowRight a column; boundaries do not throw.
  await page.focus("#grid-option-t0");
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.activeElement?.id === "grid-option-t3");
  await page.keyboard.press("ArrowDown");
  assert.equal((await focused(page)).key, "t3");
  await page.keyboard.press("ArrowRight");
  assert.equal((await focused(page)).key, "t4");
  await page.keyboard.press("ArrowUp");
  assert.equal((await focused(page)).key, "t1");
  await page.keyboard.press("ArrowUp");
  assert.equal((await focused(page)).key, "t1");
  assert.deepEqual(seen.errors, []);
  await page.context().close();
});

test("listbox: shouldFocusOnHover, escapeKeyBehavior, shouldSelectOnPressUp, select all", async () => {
  const { page, seen } = await open();
  // Hover focuses once the last interaction was a pointer (RAC: `!isFocusVisible()`).
  await page.click("#hover-option-cat");
  await page.hover("#hover-option-dog");
  await page.waitForFunction(() => document.activeElement?.id === "hover-option-dog");
  await page.hover("#hover-option-kangaroo");
  await page.waitForFunction(() => document.activeElement?.id === "hover-option-kangaroo");
  // escapeKeyBehavior="none": Escape keeps the selection.
  await page.focus("#noesc-option-cat");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  assert.equal(await text(page, "#noesc-value"), "Picked: cat, dog");
  // Default: Escape clears (multiple list).
  await page.focus("#many-option-apple");
  await page.keyboard.press("ControlOrMeta+a");
  await until(page, "#many-value", "Picked: all");
  await page.keyboard.press("Escape");
  await until(page, "#many-value", "Picked: ");
  // Mod+A does nothing in single selection.
  await page.focus("#fruit-option-apple");
  await page.keyboard.press("ControlOrMeta+a");
  await page.waitForTimeout(100);
  assert.equal(await text(page, "#fruit-value"), "Picked: banana");
  // shouldSelectOnPressUp: pointer down alone does not select; up does.
  await page.locator("#pressup").scrollIntoViewIfNeeded();
  const box = (await page.locator("#pressup-option-dog").boundingBox())!;
  await page.mouse.move(box.x + 5, box.y + 5);
  await page.mouse.down();
  await page.waitForTimeout(150);
  assert.equal(await text(page, "#pressup-value"), "Picked: ");
  await page.mouse.up();
  await until(page, "#pressup-value", "Picked: dog");
  // Default (press down): selects on mouse down.
  await page.locator("#many").scrollIntoViewIfNeeded();
  const box2 = (await page.locator("#many-option-date").boundingBox())!;
  await page.mouse.move(box2.x + 5, box2.y + 5);
  await page.mouse.down();
  await until(page, "#many-value", "Picked: date");
  await page.mouse.up();
  assert.deepEqual(seen.errors, []);
  await page.context().close();
});

test("listbox: modifier keys (unsupported modifiers do not navigate)", async () => {
  const { page } = await open();
  await page.focus("#fruit-option-apple");
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.activeElement?.id === "fruit-option-banana");
  // Mac: Ctrl+Arrow is not a list shortcut; Windows: Alt+Arrow is not.
  const unsupported = process.platform === "darwin" ? "Control" : "Alt";
  await page.keyboard.press(`${unsupported}+ArrowDown`);
  await page.waitForTimeout(100);
  assert.equal((await focused(page)).key, "banana");
  // Multiple replace: the non-contiguous modifier moves focus without changing the selection.
  const nonContiguous = process.platform === "darwin" ? "Alt" : "Control";
  await page.click("#replace-option-apple");
  await until(page, "#replace-value", "Picked: apple; action: none");
  await page.keyboard.press(`${nonContiguous}+ArrowDown`);
  await page.waitForFunction(() => document.activeElement?.id === "replace-option-banana");
  assert.deepEqual(await selected(page, "replace"), ["apple"]);
  // Windows: Control+Shift+End extends to the end. Mac has no Mod+Shift+End shortcut: Shift+End
  // moves focus and the selection follows (useSelectableCollection `withShiftSel`).
  if (process.platform === "darwin") {
    await page.keyboard.press("Shift+End");
    await until(page, "#replace-value", "Picked: elderberry; action: none");
  } else {
    await page.keyboard.press("Control+Shift+End");
    await until(page, "#replace-value", "Picked: apple, banana, date, elderberry; action: none");
  }
  await page.context().close();
});

test("listbox: links with selectionMode none", async () => {
  const { page } = await open();
  assert.equal(await page.evaluate(() => document.querySelector("#links-option-tabs")!.tagName), "A");
  assert.equal(await page.getAttribute("#links-option-tabs", "href"), "/tabs");
  assert.equal(await page.getAttribute("#links-option-tabs", "aria-selected"), null);
  await page.focus("#links-option-home");
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.activeElement?.id === "links-option-tabs");
  await Promise.all([page.waitForURL(/\/tabs$/), page.keyboard.press("Enter")]);
  await page.context().close();
  const { page: mouse } = await open();
  await Promise.all([mouse.waitForURL(/\/tabs$/), mouse.click("#links-option-tabs")]);
  await mouse.context().close();
});
