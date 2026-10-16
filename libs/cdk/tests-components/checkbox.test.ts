// Checkbox / CheckboxGroup / Switch — ported from react-aria-components test/Checkbox.test.js,
// test/CheckboxGroup.test.js, test/Switch.test.js and react-aria test/checkbox/useCheckboxGroup.test.tsx
// (Apache-2.0, © Adobe), run against the resumed story app in Chromium.
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
const checked = (page: Page, selector: string) => page.evaluate((s) => (document.querySelector(s) as HTMLInputElement).checked, selector);
const labelOf = (selector: string) => `label:has(${selector})`;

test("checkbox: renders, data attributes, description, native required (RAC 'should render a checkbox with default class')", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/checkbox");
  assert.equal(await page.getByRole("checkbox", { name: "Accept terms" }).count(), 1);
  assert.equal(await attr(page, labelOf("#cb-terms"), "class"), "rv-CheckboxButton");
  assert.equal(await attr(page, labelOf("#cb-terms"), "data-required"), "true");
  assert.equal(await attr(page, "#cb-terms", "required"), "");
  // RA useSlotId: the server keeps the error slot id; the resumed slot effect drops it.
  await waitAttr(page, "#cb-terms", "aria-describedby", "cb-terms-description");
  assert.equal(await attr(page, labelOf("#cb-ro"), "data-readonly"), "true");
  assert.equal(await attr(page, "#cb-ro", "aria-readonly"), "true");
  assert.equal(await attr(page, labelOf("#cb-dis"), "data-disabled"), "true");
  assert.equal(await attr(page, "#cb-dis", "disabled"), "");
  assert.equal(await attr(page, labelOf("#cb-mixed"), "data-indeterminate"), "true");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("checkbox: toggles via click and Space; data-selected follows; indeterminate property", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/checkbox");
  await page.waitForFunction(() => (document.getElementById("cb-mixed") as HTMLInputElement).indeterminate === true);
  await page.click(labelOf("#cb-terms"));
  await waitText(page, "#cb-value", "terms=yes");
  // The label bindings resume after the input handler: wait for them.
  await waitAttr(page, labelOf("#cb-terms"), "data-selected", "true");
  await page.keyboard.press("Space");
  await waitText(page, "#cb-value", "terms=no");
  assert.equal(await attr(page, labelOf("#cb-terms"), "data-selected"), null);
  // Clicking the label toggles too.
  await page.click(labelOf("#cb-terms"));
  await waitText(page, "#cb-value", "terms=yes");
  await page.click(labelOf("#cb-mixed"));
  await waitText(page, "#cb-value", "mixed=no");
  await page.waitForFunction(() => (document.getElementById("cb-mixed") as HTMLInputElement).indeterminate === false);
  await page.close();
});

test("checkbox: read-only does not toggle; disabled is not focusable", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/checkbox");
  await page.click(labelOf("#cb-ro"));
  // give the resumed handler a chance to run
  await page.focus("#cb-ro");
  await page.keyboard.press("Space");
  await page.waitForTimeout(100);
  assert.equal(await checked(page, "#cb-ro"), true);
  assert.equal(await attr(page, labelOf("#cb-ro"), "data-selected"), "true");
  assert.equal(await page.evaluate(() => (document.getElementById("cb-dis") as HTMLInputElement).disabled), true);
  await page.close();
});

test("checkbox: native validation on submit, error message, cleared on change (RAC 'supports validation errors')", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/checkbox");
  await page.click("#cb-submit");
  await waitAttr(page, "#cb-terms", "aria-invalid", "true");
  // The error id joins aria-describedby once FieldError has mounted (a later flush than aria-invalid).
  await waitAttr(page, "#cb-terms", "aria-describedby", "cb-terms-description cb-terms-error");
  assert.equal(await page.textContent("#cb-terms-error"), "Accept to continue");
  assert.equal(await attr(page, labelOf("#cb-terms"), "data-invalid"), "true");
  await waitFocus(page, "cb-terms");
  assert.equal(new URL(page.url()).search, "");
  await page.keyboard.press("Space");
  await waitAttr(page, "#cb-terms", "aria-invalid", null);
  assert.equal(await page.isHidden("#cb-terms-error"), true);
  await page.close();
});

test("checkbox: aria validation is realtime", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/checkbox");
  assert.equal(await attr(page, "#cb-aria", "aria-invalid"), "true");
  await page.click(labelOf("#cb-aria"));
  await waitAttr(page, "#cb-aria", "aria-invalid", null);
  await page.click(labelOf("#cb-aria"));
  await waitAttr(page, "#cb-aria", "aria-invalid", "true");
  await page.close();
});

test("checkbox group: role group, label, description, value, disabled item (useCheckboxGroup)", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/checkbox");
  const group = page.getByRole("group", { name: "Pets" });
  assert.equal(await group.count(), 1);
  assert.equal(await attr(page, "#cb-pets", "aria-labelledby"), "cb-pets-label");
  await waitAttr(page, "#cb-pets", "aria-describedby", "cb-pets-description");
  assert.equal(await attr(page, "#cb-pets", "data-required"), "true");
  // Required while nothing is selected: every box natively required.
  assert.equal(await page.locator("#cb-pets input[required]").count(), 3);
  assert.equal(await page.locator('#cb-pets input[value="dragons"]').isDisabled(), true);
  await page.locator("label", { has: page.getByRole("checkbox", { name: "Cats" }) }).click();
  await waitText(page, "#cb-value", "pets=cats");
  await page.waitForFunction(() => document.querySelectorAll("#cb-pets input[required]").length === 0);
  await page.locator("label", { has: page.getByRole("checkbox", { name: "Dogs" }) }).click();
  await waitText(page, "#cb-value", "pets=cats,dogs");
  assert.equal(await attr(page, labelOf('input[value="dogs"]'), "data-selected"), "true");
  await page.getByRole("checkbox", { name: "Cats" }).uncheck({ force: true });
  await waitText(page, "#cb-value", "pets=dogs");
  await page.close();
});

test("checkbox group: required + server errors block submit; read-only group does not change", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/checkbox");
  assert.equal(await attr(page, "#cb-news", "data-invalid"), "true");
  assert.equal(await page.textContent("#cb-news-error"), "Pick a newsletter");
  await page.click(labelOf("#cb-terms"));
  await page.click("#cb-submit");
  await waitAttr(page, "#cb-pets", "data-invalid", "true");
  assert.equal(await attr(page, "#cb-pets", "aria-describedby"), "cb-pets-description cb-pets-error");
  assert.equal(new URL(page.url()).search, "");
  await page.locator("label", { has: page.getByRole("checkbox", { name: "Dogs" }) }).click();
  await waitAttr(page, "#cb-pets", "data-invalid", null);
  // Server error clears once the group is edited.
  await page.locator("label", { has: page.getByRole("checkbox", { name: "Weekly" }) }).click();
  await waitAttr(page, "#cb-news", "data-invalid", null);
  await page.click('#cb-rog label:has(input[value="b"])');
  await page.waitForTimeout(100);
  assert.equal(await checked(page, '#cb-rog input[value="b"]'), false);
  await page.click("#cb-submit");
  await page.waitForURL(/pets=dogs/);
  assert.match(page.url(), /news=weekly/);
  assert.match(page.url(), /terms=yes/);
  await page.close();
});

test("checkbox: form reset restores defaults", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/checkbox");
  await page.click(labelOf("#cb-terms"));
  await page.locator("label", { has: page.getByRole("checkbox", { name: "Cats" }) }).click();
  await waitText(page, "#cb-value", "terms=yes mixed=yes pets=cats");
  await page.click("#cb-reset");
  await waitText(page, "#cb-value", "terms=no mixed=yes pets=");
  assert.equal(await checked(page, "#cb-terms"), false);
  assert.equal(await checked(page, '#cb-pets input[value="cats"]'), false);
  await page.close();
});

test("switch: role switch, toggles, read-only (RAC Switch.test)", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/checkbox");
  const sw = page.getByRole("switch", { name: "Power" });
  assert.equal(await sw.count(), 1);
  assert.equal(await attr(page, labelOf("#sw-power"), "class"), "rv-Switch");
  await page.click(labelOf("#sw-power"));
  await waitText(page, "#cb-value", "power=on");
  assert.equal(await attr(page, labelOf("#sw-power"), "data-selected"), "true");
  await page.keyboard.press("Space");
  await waitText(page, "#cb-value", "power=off");
  await page.click(labelOf("#sw-ro"));
  await page.waitForTimeout(100);
  assert.equal(await checked(page, "#sw-ro"), true);
  assert.equal(await attr(page, "#sw-ro", "aria-readonly"), "true");
  await page.close();
});
