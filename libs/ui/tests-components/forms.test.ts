// Form components — resumed story app (`/forms`): the upstream cases that need a real browser (keyboard focus-visible, presses,
// native form validation): TextField two-way value, InputGroup prefix click focuses the input, SearchField clear button +
// focus-visible, NumberField steppers / ArrowUp / max clamp + focus-visible, Form submit blocked while invalid then counted.
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

const text = (page: Page, sel: string) => page.textContent(sel);

test("forms: SSR markup = HeroUI classes + data-slots", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/forms");
    assert.equal(await page.getAttribute("[data-testid=tf]", "data-slot"), "textfield");
    assert.equal(await page.getAttribute("#tf-input", "class"), "input input--primary");
    assert.equal(await page.getAttribute("#ig", "data-slot"), "input-group");
    assert.equal(await page.getAttribute("#sf-input", "type"), "search");
    assert.equal(await page.getAttribute("#nf-input", "value"), "10");
    await page.waitForLoadState("networkidle");
    assert.deepEqual(seen.errors, []);
  }));

test("forms: TextField two-way value; InputGroup prefix click focuses the input", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/forms");
    await page.fill("#tf-input", "Ada");
    await page.waitForFunction(() => document.querySelector("#tf-state")?.textContent === "Ada");
    await page.click("#ig-prefix");
    await page.waitForFunction(() => document.activeElement?.id === "ig-input");
    assert.deepEqual(seen.errors, []);
  }));

test("forms (upstream): keyboard focus marks focus-visible; SearchField clear button empties the field", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/forms");
    await page.focus("#tf-input");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => document.activeElement?.id === "sf-input");
    await page.waitForFunction(() => document.querySelector("#sf-input")?.getAttribute("data-focus-visible") === "true");
    await page.click("#sf-clear");
    await page.waitForFunction(() => (document.querySelector("#sf-input") as HTMLInputElement).value === "");
    await page.waitForFunction(() => document.querySelector("[data-testid=sf]")?.getAttribute("data-empty") === "true");
    assert.deepEqual(seen.errors, []);
  }));

test("forms (upstream): NumberField steppers, ArrowUp, maxValue clamp", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/forms");
    await page.click("#nf-inc");
    await page.waitForFunction(() => document.querySelector("#nf-state")?.textContent === "11");
    await page.click("#nf-dec");
    await page.waitForFunction(() => document.querySelector("#nf-state")?.textContent === "10");
    await page.focus("#nf-input");
    await page.keyboard.press("ArrowUp");
    await page.waitForFunction(() => document.querySelector("#nf-state")?.textContent === "11");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await page.waitForFunction(() => document.querySelector("#nf-state")?.textContent === "12");
    assert.equal(await text(page, "#nf-state"), "12");
    assert.deepEqual(seen.errors, []);
  }));

test("forms (upstream): Form submit is blocked while a required field is empty, then submits", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/forms");
    await page.click("#form-submit");
    await page.waitForSelector("#form-error");
    // RAC: the first invalid field of the form takes focus (keyboard modality → focus ring).
    await page.waitForFunction(() => document.activeElement?.id === "form-email");
    assert.equal(await text(page, "#form-state"), "0");
    await page.fill("#form-email", "ada@example.com");
    // Commit the value first (native `change` on blur): the error line disappears and the button moves up (same as upstream).
    await page.locator("#form-email").blur();
    await page.waitForSelector("#form-error", { state: "detached" });
    await page.click("#form-submit");
    await page.waitForFunction(() => document.querySelector("#form-state")?.textContent === "1");
    assert.deepEqual(seen.errors, []);
  }));

test("input-otp (upstream): keyboard typing fills the slots, active slot + fake caret, onComplete, Backspace, paste-like insert", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/forms");
    const otp = "[data-testid=otp]";
    assert.equal(await page.getAttribute(otp, "data-slot"), "input-otp");
    assert.equal(await page.getAttribute(otp, "autocomplete"), "one-time-code");
    await page.click(otp);
    await page.waitForFunction(() => document.querySelector("#otp-0")?.getAttribute("data-active") === "true");
    assert.ok(await page.$("#otp-0 [data-slot=input-otp-caret]"), "fake caret in the empty active slot");
    await page.keyboard.type("123");
    await page.waitForFunction(() => document.querySelector("#otp-state")?.textContent === "123");
    assert.equal(await page.textContent("#otp-2 [data-slot=input-otp-slot-value]"), "3");
    await page.waitForFunction(() => document.querySelector("#otp-3")?.getAttribute("data-active") === "true");
    assert.equal(await page.getAttribute("#otp-0", "data-filled"), "true");
    await page.keyboard.type("456");
    await page.waitForFunction(() => document.querySelector("#otp-done")?.textContent === "123456");
    // Full: the last slot stays selected (single caret at the end → select the last char).
    await page.waitForFunction(() => document.querySelector("#otp-5")?.getAttribute("data-active") === "true");
    await page.keyboard.press("Backspace");
    await page.waitForFunction(() => document.querySelector("#otp-state")?.textContent === "12345");
    assert.equal(await page.getAttribute("#otp-5", "data-filled"), null);
    // Paste-like insert (select all + insertText = what a native paste does in the input).
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.insertText("654321");
    await page.waitForFunction(() => document.querySelector("#otp-state")?.textContent === "654321");
    assert.equal(await page.$$eval("[data-slot=input-otp-slot][data-filled=true]", (els) => els.length), 6);
    // Root height variable from the input's clientHeight (mount effect ran on the resumed page).
    assert.match((await page.$eval("[data-input-otp-container]", (el) => (el as HTMLElement).style.getPropertyValue("--root-height"))) ?? "", /^\d+px$/);
    assert.ok(await page.$("#input-otp-style"), "one style tag per document");
    assert.deepEqual(seen.errors, []);
  }));

test("shorthand (T21): SearchField / NumberField / NumberStepper / NativeSelect / InputOTP shorthand forms work on a resumed page", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/forms");
    const until = (sel: string, value: string) => page.waitForFunction(([s, v]) => document.querySelector(s!)?.textContent === v, [sel, value] as const);
    // SearchField: label + description named by the input, clear button empties the value.
    const sf = "[data-testid=sh-sf]";
    const by = (await page.getAttribute(`${sf} input`, "aria-describedby"))!;
    assert.equal(await page.locator(`[id="${by}"]`).textContent(), "Titles only");
    assert.equal(await page.getAttribute(`${sf} input`, "placeholder"), "Search...");
    await page.click(`${sf} [data-slot=search-field-clear-button]`);
    await until("#sh-sf-state", "");
    // NumberField + NumberStepper steppers.
    await page.click("[data-testid=sh-nf] [data-slot=number-field-increment-button]");
    await until("#sh-nf-state", "6");
    await page.click("[data-testid=sh-ns] [data-slot=number-stepper-increment-button]");
    await until("#sh-ns-state", "2");
    // NativeSelect items.
    await page.selectOption("[data-testid=sh-sel] select", "black");
    await until("#sh-sel-state", "black");
    // InputOTP: one group of maxLength slots.
    assert.equal(await page.locator("[data-input-otp-container]:has([data-testid=sh-otp]) [data-slot=input-otp-group]").count(), 1);
    assert.equal(await page.locator("[data-input-otp-container]:has([data-testid=sh-otp]) [data-slot=input-otp-slot]").count(), 4);
    await page.click("[data-testid=sh-otp]");
    await page.keyboard.type("4321");
    await until("#sh-otp-state", "4321");
    assert.deepEqual(seen.errors, []);
  }));
