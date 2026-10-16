// RadioGroup — ported from react-aria-components test/RadioGroup.test.js and react-aria
// test/radio/useRadioGroup.test.tsx (Apache-2.0, © Adobe), run against the resumed story app in Chromium.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const attr = (page: Page, selector: string, name: string) => page.getAttribute(selector, name);
const waitAttr = (page: Page, selector: string, name: string, value: string | null) =>
  page.waitForFunction(([selector, name, value]) => (document.querySelector(selector!)?.getAttribute(name!) ?? null) === value, [
    selector,
    name,
    value,
  ] as const);
const waitText = (page: Page, selector: string, value: string) =>
  page.waitForFunction(([selector, value]) => document.querySelector(selector!)?.textContent?.replace(/\s+/g, " ").trim().includes(value!), [
    selector,
    value,
  ] as const);
const waitFocus = (page: Page, id: string) => page.waitForFunction((id) => document.activeElement?.id === id, id);
const focused = (page: Page) => page.evaluate(() => document.activeElement?.id);
const checked = (page: Page, id: string) => page.evaluate((id) => (document.getElementById(id) as HTMLInputElement).checked, id);
const labelOf = (id: string) => `label:has(> #${id})`;

test("radio group: roles, label, description, orientation, required (RAC 'should render a radio group')", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/radio-group");
  assert.equal(await page.getByRole("radiogroup", { name: "Favorite pet" }).count(), 1);
  assert.equal(await page.getByRole("radio").count(), 14);
  assert.equal(await attr(page, "#rg-pets", "aria-labelledby"), "rg-pets-label");
  assert.equal(await attr(page, "#rg-pets", "aria-describedby"), "rg-pets-description");
  assert.equal(await attr(page, "#rg-pets", "aria-orientation"), "vertical");
  assert.equal(await attr(page, "#rg-size", "aria-orientation"), "horizontal");
  assert.equal(await attr(page, "#rg-pets", "aria-required"), "true");
  assert.equal(await attr(page, "#rg-dogs", "required"), "");
  // Radio description + group description (RA useRadio aria-describedby).
  assert.equal(await attr(page, "#rg-cats", "aria-describedby"), "rg-cats-description rg-pets-description");
  assert.equal(await attr(page, "#rg-dogs", "aria-describedby"), "rg-pets-description");
  assert.equal(await attr(page, labelOf("rg-dragons"), "data-disabled"), "true");
  assert.equal(await attr(page, "#rg-ro", "aria-readonly"), "true");
  assert.equal(await attr(page, "#rg-dis", "aria-disabled"), "true");
  assert.equal(await attr(page, "#rg-x", "disabled"), "");
  assert.equal(await attr(page, labelOf("rg-m"), "data-selected"), "true");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("radio group: arrow keys move + select, wrap, skip disabled (useRadioGroup keyboard)", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/radio-group");
  await page.click("#rg-dogs");
  await waitText(page, "#rg-value", "pet=dogs");
  assert.equal(await attr(page, labelOf("rg-dogs"), "data-selected"), "true");
  await page.keyboard.press("ArrowDown");
  await waitText(page, "#rg-value", "pet=cats");
  assert.equal(await focused(page), "rg-cats");
  await page.keyboard.press("ArrowDown");
  // Dragons is disabled: skipped.
  await waitText(page, "#rg-value", "pet=fish");
  await page.keyboard.press("ArrowRight");
  // Wraps to the first.
  await waitText(page, "#rg-value", "pet=dogs");
  await page.keyboard.press("ArrowUp");
  await waitText(page, "#rg-value", "pet=fish");
  await page.keyboard.press("ArrowLeft");
  await waitText(page, "#rg-value", "pet=cats");
  assert.equal(await attr(page, labelOf("rg-dogs"), "data-selected"), null);
  await page.close();
});

test("radio group: RTL horizontal flips left/right", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/radio-group");
  await page.click("#rg-1");
  await page.keyboard.press("ArrowLeft");
  await waitFocus(page, "rg-2");
  assert.equal(await checked(page, "rg-2"), true);
  await page.keyboard.press("ArrowRight");
  await waitFocus(page, "rg-1");
  await page.close();
});

test("radio group: single tab stop on the selected radio", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/radio-group");
  await page.focus("#rg-dogs");
  await page.keyboard.press("Tab");
  // Size group: tab stop is the selected "M".
  assert.equal(await focused(page), "rg-m");
  await page.keyboard.press("Tab");
  assert.equal(await focused(page), "rg-a");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await focused(page), "rg-m");
  await page.close();
});

test("radio group: read-only keeps the selection; disabled does nothing", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/radio-group");
  await page.click("#rg-b");
  await page.waitForTimeout(100);
  assert.equal(await checked(page, "rg-b"), false);
  assert.equal(await checked(page, "rg-a"), true);
  await page.focus("#rg-a");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  assert.equal(await checked(page, "rg-a"), true);
  assert.equal(await attr(page, labelOf("rg-a"), "data-selected"), "true");
  await page.close();
});

test("radio group: native required on submit, error, server errors, submit (RAC 'supports validation errors')", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/radio-group");
  assert.equal(await attr(page, "#rg-size", "aria-invalid"), "true");
  assert.equal(await page.textContent("#rg-size-error"), "Size sold out");
  await page.click("#rg-submit");
  await waitAttr(page, "#rg-pets", "aria-invalid", "true");
  assert.equal(await page.textContent("#rg-pets-error"), "Pick a pet");
  assert.equal(await attr(page, "#rg-pets", "aria-describedby"), "rg-pets-description rg-pets-error");
  await waitAttr(page, "#rg-dogs", "aria-describedby", "rg-pets-error rg-pets-description");
  await waitFocus(page, "rg-dogs");
  assert.equal(new URL(page.url()).search, "");
  await page.keyboard.press("Space");
  await waitAttr(page, "#rg-pets", "aria-invalid", null);
  assert.equal(await page.isHidden("#rg-pets-error"), true);
  // Size still carries the server error: blocks submit. RA useFormValidation (per radio, useRadio) sets the custom
  // validity on every radio of the group and focuses the form's first invalid input: "S", not the selected "M".
  await page.click("#rg-submit");
  await waitFocus(page, "rg-s");
  assert.equal(new URL(page.url()).search, "");
  await page.click("#rg-l");
  await waitAttr(page, "#rg-size", "aria-invalid", null);
  await page.click("#rg-submit");
  await page.waitForURL(/pet=dogs/);
  assert.match(page.url(), /size=l/);
  assert.match(page.url(), /ro=a/);
  await page.close();
});

test("radio group: aria validation realtime; form reset", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/radio-group");
  await page.click("#rg-no");
  await waitAttr(page, "#rg-aria", "aria-invalid", "true");
  await page.click("#rg-yes");
  await waitAttr(page, "#rg-aria", "aria-invalid", null);
  await page.click("#rg-cats");
  await page.click("#rg-s");
  await waitText(page, "#rg-value", "pet=cats");
  await page.click("#rg-reset");
  await waitText(page, "#rg-value", "pet=-");
  assert.equal(await checked(page, "rg-m"), true);
  assert.equal(await attr(page, labelOf("rg-m"), "data-selected"), "true");
  assert.equal(await checked(page, "rg-cats"), false);
  await page.close();
});
