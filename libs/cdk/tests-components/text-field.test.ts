// TextField / TextArea / Form validation — ported from react-aria-components test/TextField.test.js,
// test/Form.test.js and react-aria test/textfield/useTextField.test.js (Apache-2.0, © Adobe), run
// against the resumed story app in Chromium.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const attr = (page: Page, selector: string, name: string) => page.getAttribute(selector, name);
/** Wait until `selector`'s attribute equals `value` (null: absent). */
const waitAttr = (page: Page, selector: string, name: string, value: string | null) =>
  page.waitForFunction(([selector, name, value]) => (document.querySelector(selector!)?.getAttribute(name!) ?? null) === value, [selector, name, value] as const);
const waitText = (page: Page, selector: string, value: string) =>
  page.waitForFunction(([selector, value]) => document.querySelector(selector!)?.textContent?.replace(/\s+/g, " ").trim().includes(value!), [selector, value] as const);
const waitFocus = (page: Page, id: string) => page.waitForFunction((id) => document.activeElement?.id === id, id);
const validationMessage = (page: Page, id: string) => page.evaluate((id) => (document.getElementById(id) as HTMLInputElement).validationMessage, id);

test("textfield: label, description, ids, required (native)", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/text-field");
  assert.equal(await attr(page, "#tf-name", "aria-labelledby"), "tf-name-label");
  assert.equal(await attr(page, "#tf-name-label", "for"), "tf-name");
  // RA useSlotId: the server render keeps the error slot id; the resumed slot effect drops it (no error part).
  await waitAttr(page, "#tf-name", "aria-describedby", "tf-name-description");
  assert.equal(await attr(page, "#tf-name", "required"), "");
  assert.equal(await attr(page, "#tf-name", "aria-required"), null);
  // aria behaviour: aria-required, no native required.
  assert.equal(await attr(page, "#tf-aria", "aria-required"), "true");
  assert.equal(await attr(page, "#tf-aria", "required"), null);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("textfield: native validation shows on submit, clears after edit + commit (RAC 'supports validation errors')", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/text-field");
  assert.equal(await page.evaluate(() => (document.getElementById("tf-name") as HTMLInputElement).validity.valid), false);
  await page.click("#tf-submit");
  // Invalid: committed, error shown, first invalid focused, submit blocked.
  await waitAttr(page, "#tf-name", "aria-describedby", "tf-name-description tf-name-error");
  assert.equal(await page.textContent("#tf-name-error"), "Please fill out this field.");
  assert.equal(await attr(page, "#tf-name", "aria-invalid"), "true");
  assert.equal(await page.evaluate(() => document.getElementById("tf-name")!.closest(".rv-TextField")!.hasAttribute("data-invalid")), true);
  assert.equal(await page.evaluate(() => document.activeElement?.id), "tf-name");
  assert.equal(new URL(page.url()).search, "");
  await page.keyboard.type("Devon");
  await waitText(page, "#tf-value", "name=Devon");
  // Still displayed until commit (native behaviour).
  assert.equal(await attr(page, "#tf-name", "aria-invalid"), "true");
  assert.equal(await validationMessage(page, "tf-name"), "");
  await page.keyboard.press("Tab");
  await waitAttr(page, "#tf-name", "aria-invalid", null);
  assert.equal(await attr(page, "#tf-name", "aria-describedby"), "tf-name-description");
  assert.equal(await page.isHidden("#tf-name-error"), true);
  await page.close();
});

test("textfield: server errors from <Form validationErrors> block submit until edited", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/text-field");
  assert.equal(await attr(page, "#tf-user", "aria-invalid"), "true");
  assert.equal(await page.textContent("#tf-user-error"), "Username taken");
  await page.fill("#tf-name", "Ada");
  await page.click("#tf-submit");
  // Cold field: the Form's submit handler applied the pending custom validity → blocked, focused.
  await waitFocus(page, "tf-user");
  assert.equal(new URL(page.url()).search, "");
  await page.keyboard.press("End");
  await page.keyboard.type("x");
  await page.keyboard.press("Tab");
  await waitAttr(page, "#tf-user", "aria-invalid", null);
  assert.equal(await page.isHidden("#tf-user-error"), true);
  await page.click("#tf-submit");
  await page.waitForURL(/name=Ada/);
  assert.match(page.url(), /username=adax/);
  await page.close();
});

test("textfield: custom validate + errorMessage function; aria behaviour validates in realtime", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/text-field");
  await page.fill("#tf-code", "ab");
  await page.waitForFunction(() => (document.getElementById("tf-code") as HTMLInputElement).validationMessage === "At least 3 characters");
  // Native: not displayed before commit.
  assert.equal(await attr(page, "#tf-code", "aria-invalid"), null);
  await page.keyboard.press("Tab");
  await waitAttr(page, "#tf-code", "aria-invalid", "true");
  await waitText(page, "#tf-code-error", "At least 3 characters");
  await page.fill("#tf-aria", "bad");
  await waitAttr(page, "#tf-aria", "aria-invalid", "true");
  await waitText(page, "#tf-aria-error", "No bad");
  assert.equal(await page.evaluate(() => (document.getElementById("tf-aria") as HTMLInputElement).validity.valid), true);
  await page.fill("#tf-aria", "good");
  await waitAttr(page, "#tf-aria", "aria-invalid", null);
  await page.close();
});

test("textfield: form reset restores the value and clears validation (useFormReset)", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/text-field");
  await page.fill("#tf-name", "Grace");
  await waitText(page, "#tf-value", "name=Grace");
  await page.fill("#tf-code", "ab");
  await page.keyboard.press("Tab");
  await waitAttr(page, "#tf-code", "aria-invalid", "true");
  await page.click("#tf-reset");
  await waitText(page, "#tf-value", "name= code=");
  await waitAttr(page, "#tf-code", "aria-invalid", null);
  await page.close();
});
