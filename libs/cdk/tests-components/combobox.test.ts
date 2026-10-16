// ComboBox (RAC port) on the resumed production story build (/combobox): SSR markup, resume on first
// interaction, filtering, keyboard, commit, hidden input, custom value, multiple, validation.
// Upstream suites (RAC ComboBox.test.js, RA useComboBox.test.js) are ported in ../tests/combobox*.browser.test.tsx.
// Known failing (2026-10-06, runtime, routed to the resume-client lane): the first interaction's cold events are lost —
// on activation the Input's resumed spread re-applies every attribute incl. `value` from the stale server state.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const norm = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();
const untilText = (page: Page, selector: string, value: string) =>
  page
    .waitForFunction(
      ([selector, value]) => (document.querySelector(selector!)?.textContent ?? "").replace(/\s+/g, " ").trim() === value,
      [selector, value] as const,
      { timeout: 5000 },
    )
    .catch(async () => assert.equal(norm(await page.textContent(selector)), value));
const expanded = (page: Page, id: string, value: "true" | "false") =>
  page.waitForFunction(([id, value]) => document.getElementById(id!)?.getAttribute("aria-expanded") === value, [id, value] as const, { timeout: 5000 });
const listOf = (page: Page, id: string) => page.evaluate((id) => document.getElementById(id)?.getAttribute("aria-controls") ?? null, id);
const optionTexts = async (page: Page, id: string) => {
  const list = await listOf(page, id);
  return page.$$eval(`[id="${list}"] [role=option]`, (els) => els.map((el) => (el.textContent ?? "").trim()));
};

test("SSR: combobox input, label, description, button; closed", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/combobox");
  const input = page.locator("#fruit");
  assert.equal(await input.getAttribute("role"), "combobox");
  assert.equal(await input.getAttribute("aria-expanded"), "false");
  assert.equal(await input.getAttribute("aria-autocomplete"), "list");
  assert.equal(await page.getByRole("combobox", { name: "Fruit" }).count(), 1);
  // SSR keeps slot ids of parts that may not render (RA useSlotId first render); the description is one of them.
  const describedBy = ((await input.getAttribute("aria-describedby")) ?? "").split(" ");
  const texts = await page.evaluate((ids) => ids.map((id) => document.getElementById(id)?.textContent?.trim() ?? null), describedBy);
  assert.ok(texts.includes("Pick a fruit"), String(texts));
  assert.equal(await page.getAttribute("#fruit-button", "aria-haspopup"), "listbox");
  assert.equal(await page.getAttribute("#fruit-button", "tabindex"), "-1");
  assert.equal(await page.locator(".rv-ComboBox").first().getAttribute("data-open"), null);
  assert.equal(await page.locator("[role=listbox]").count(), 0);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("typing filters (accent-insensitive), arrow keys move virtual focus, Enter commits, hidden input", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/combobox");
  await page.focus("#fruit");
  await page.keyboard.type("ap");
  await expanded(page, "fruit", "true");
  assert.deepEqual(await optionTexts(page, "fruit"), ["Apple", "Apricot"]);
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => /-option-apple$/.test(document.getElementById("fruit")?.getAttribute("aria-activedescendant") ?? ""));
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => /-option-apricot$/.test(document.getElementById("fruit")?.getAttribute("aria-activedescendant") ?? ""));
  assert.equal(await page.evaluate(() => document.activeElement?.id), "fruit", "DOM focus stays on the input");
  await page.keyboard.press("Enter");
  await untilText(page, "#combo-value", "Picked: apricot");
  assert.equal(await page.inputValue("#fruit"), "Apricot");
  await expanded(page, "fruit", "false");
  assert.equal(await page.inputValue("input[type=hidden][name=fruit]"), "apricot");

  await page.fill("#fruit", "");
  await page.keyboard.type("creme");
  await expanded(page, "fruit", "true");
  assert.deepEqual(await optionTexts(page, "fruit"), ["Crème de cassis"]);
  await page.keyboard.press("Escape");
  await expanded(page, "fruit", "false");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("button opens the full list; clicking an option selects it; onOpenChange", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/combobox");
  await page.click("#fruit-button");
  await expanded(page, "fruit", "true");
  assert.deepEqual(await optionTexts(page, "fruit"), ["Apple", "Apricot", "Banana", "Cherry", "Crème de cassis", "Date"]);
  const list = await listOf(page, "fruit");
  assert.equal(await page.getAttribute(`[id="${list}-option-cherry"]`, "aria-disabled"), "true");
  await page.click(`[id="${list}-option-banana"]`);
  await untilText(page, "#combo-value", "Picked: banana");
  assert.equal(await page.inputValue("#fruit"), "Banana");
  await expanded(page, "fruit", "false");
  await untilText(page, "#combo-log", "open:true open:false");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("static items, menuTrigger focus", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/combobox");
  await page.focus("#static");
  await expanded(page, "static", "true");
  assert.deepEqual(await optionTexts(page, "static"), ["One", "Two", "Three"]);
  await page.keyboard.type("t");
  await page.waitForFunction(
    () => document.querySelectorAll(`[id="${document.getElementById("static")!.getAttribute("aria-controls")}"] [role=option]`).length === 2,
  );
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("allowsCustomValue: typed text is kept on blur and two-way bound", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/combobox");
  await page.focus("#custom");
  await page.keyboard.type("Kiwi");
  await untilText(page, "#custom-value", "Text: Kiwi");
  await page.keyboard.press("Tab");
  assert.equal(await page.inputValue("#custom"), "Kiwi");
  assert.equal(await page.inputValue("input[name=custom]"), "Kiwi");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("multiple selection: ComboBoxValue lists the selected items; hidden inputs per key", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/combobox");
  await untilText(page, "#multi-value", "Apple");
  await page.click("#multi-button");
  await expanded(page, "multi", "true");
  const list = await listOf(page, "multi");
  await page.click(`[id="${list}-option-banana"]`);
  await untilText(page, "#multi-value", "Apple and Banana");
  assert.deepEqual(await page.$$eval("input[type=hidden][name=multi]", (els) => els.map((el) => (el as HTMLInputElement).value)), ["apple", "banana"]);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("validation (native): a blocked submit shows the required error", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/combobox");
  assert.equal(await page.getAttribute("#required", "required"), "");
  // RS useComboBoxState: blur commits validation only when the value changed, so focus + Tab shows nothing.
  await page.focus("#required");
  await page.keyboard.press("Tab");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.getAttribute("#required", "aria-invalid"), null);
  // The invalid event (RA useFormValidation onInvalid) commits it: the FieldError renders and describes the input.
  await page.evaluate(() => (document.getElementById("required-form") as HTMLFormElement).requestSubmit());
  await page.waitForFunction(() => document.getElementById("required")?.getAttribute("aria-invalid") === "true", null, { timeout: 5000 });
  const error = norm(await page.textContent("#required-form .rv-FieldError"));
  assert.ok(error.length > 0);
  await page.waitForFunction(
    (error) =>
      (document.getElementById("required")?.getAttribute("aria-describedby") ?? "")
        .split(" ")
        .some((id) => document.getElementById(id)?.textContent?.trim() === error),
    error,
    { timeout: 5000 },
  );
  assert.deepEqual(seen.errors, []);
  await page.close();
});
