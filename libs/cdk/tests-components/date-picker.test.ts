// DatePicker / DateRangePicker — ported from react-aria-components test/DatePicker.test.js and
// test/DateRangePicker.test.js (react-spectrum, Apache-2.0, © Adobe), run against the resumed story
// app in Chromium, plus the Rivet checks (SSR renders no popover, nothing ships before
// interaction, focus into the calendar on open and back on close, Escape, typing segments).
// RAC slot / context / render-prop cases have no counterpart in the data-driven API (no slots).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { among, codeOf, markDeferred, scriptsBeforeDeferred, stories, watch, type Stories } from "./harness.ts";

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
const waitFocus = (page: Page, selector: string) => page.waitForFunction((selector) => !!document.activeElement?.matches(selector), selector);
/** Text of a DateInput without the bidi isolates. */
const inputText = (page: Page, id: string) => page.evaluate((id) => document.getElementById(id)!.textContent!.replace(/[⁦-⁩]/g, ""), id);
const waitInputText = (page: Page, id: string, value: string) =>
  page.waitForFunction(([id, value]) => document.getElementById(id!)?.textContent?.replace(/[⁦-⁩]/g, "") === value, [id, value] as const);
/** Text of the elements `aria-describedby` of `selector` references. */
const description = (page: Page, selector: string) =>
  page.evaluate(
    (selector) =>
      (document.querySelector(selector)!.getAttribute("aria-describedby") ?? "")
        .split(" ")
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ")
        .trim(),
    selector,
  );
// Date code: chunks holding the date components' symbols + the shared code only they import (build manifest).
const libraryScripts = (seen: { scripts: string[] }) => among(seen.scripts, codeOf(/#(DatePicker|DateRangePicker|DateInput|DateField|Calendar)\w*\$/));

test("datepicker: SSR markup — parts, labels, placeholder segments, closed popover renders nothing (RAC 'provides slots')", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await markDeferred(page);
  const response = await page.goto(s.origin + "/date-picker");
  const html = await response!.text();
  // Closed: no popover / dialog / calendar markup on the server.
  assert.equal(/rv-Popover|role="dialog"|rv-Calendar/.test(html), false);
  assert.equal(await inputText(page, "dp-field"), "mm/dd/yyyy");
  assert.equal(await attr(page, "#dp-button", "aria-label"), "Calendar");
  assert.equal(await attr(page, "#dp-button", "aria-haspopup"), "dialog");
  assert.equal(await attr(page, "#dp-button", "aria-expanded"), "false");
  assert.equal(await attr(page, "#dp", "role"), "group");
  assert.equal(await attr(page, "#dp", "aria-labelledby"), "dp-label");
  assert.equal(await page.textContent("#dp-label"), "Birth date");
  assert.equal(await attr(page, "#dp-label", "class"), "rv-Label");
  assert.equal(await description(page, "#dp"), "Description");
  assert.equal(await attr(page, "#dp-field", "role"), "presentation");
  const segments = await page.$$eval("#dp-field [role=spinbutton]", (els) =>
    els.map((el) => ({
      cls: el.className,
      placeholder: el.getAttribute("data-placeholder"),
      type: el.getAttribute("data-type"),
      label: el.getAttribute("aria-label"),
      by: el.getAttribute("aria-labelledby"),
    })),
  );
  assert.deepEqual(
    segments.map((s) => s.type),
    ["month", "day", "year"],
  );
  for (const segment of segments) {
    assert.equal(segment.cls, "rv-DateSegment");
    assert.equal(segment.placeholder, "true");
    assert.match(segment.by!, /dp-label$/);
  }
  assert.equal(segments[0]!.label, "month, ");
  // Nothing loads by itself: no library chunk before the loader's deferred (idle / preload) work, which by design warms
  // chunks after load and would race a fixed wait.
  await page.waitForTimeout(100);
  assert.deepEqual(libraryScripts({ scripts: await scriptsBeforeDeferred(page) }), []);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("datepicker: button opens a dialog popover; data-pressed, data-open, data-trigger; focus into calendar (RAC 'provides slots', 'isPressed', 'data-open')", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/date-picker");
  assert.equal(await attr(page, "#dp-button", "data-pressed"), null);
  assert.equal(await page.evaluate(() => document.getElementById("dp")!.closest(".rv-DatePicker")!.hasAttribute("data-open")), false);
  await page.click("#dp-button");
  await page.waitForSelector("[role=dialog]");
  assert.equal(await attr(page, "[role=dialog]", "class"), "rv-Dialog");
  assert.equal(await attr(page, "[role=dialog]", "aria-labelledby"), "dp-button dp-label");
  assert.equal(await page.evaluate(() => document.querySelector("[role=dialog]")!.closest(".rv-Popover")!.getAttribute("data-trigger")), "DatePicker");
  assert.equal(await page.evaluate(() => !!document.querySelector("[role=dialog] [role=grid]")), true);
  await waitAttr(page, "#dp-button", "data-pressed", "true");
  assert.equal(await attr(page, "#dp-button", "aria-expanded"), "true");
  assert.equal(await page.evaluate(() => document.getElementById("dp")!.closest(".rv-DatePicker")!.hasAttribute("data-open")), true);
  // Focus moved to the calendar's focused cell (the placeholder date).
  await waitFocus(page, "[role=dialog] [role=grid] [tabindex='0']");
  assert.match((await page.evaluate(() => document.activeElement!.getAttribute("aria-label")))!, /February 15, 2019/);
  // Escape closes; focus returns to the button.
  await page.keyboard.press("Escape");
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  await waitFocus(page, "#dp-button");
  await waitAttr(page, "#dp-button", "aria-expanded", "false");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("datepicker: selecting a date closes (shouldCloseOnSelect) and fills the field (RAC 'close on select = true')", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/date-picker");
  await page.click("#dp-sel-button");
  await page.waitForSelector("[role=dialog]");
  const selected = page.locator("[role=dialog] [role=gridcell][aria-selected=true] > *");
  assert.equal(await selected.getAttribute("aria-label"), "Sunday, February 3, 2019 selected");
  await page.click("[role=dialog] [role=gridcell][aria-selected=true] + [role=gridcell] > *");
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  await waitInputText(page, "dp-sel-field", "2/4/2019");
  await page.close();
});

test("datepicker: shouldCloseOnSelect = false keeps the popover open (RAC 'close on select = false')", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/date-picker");
  await page.click("#dp-keep-button");
  await page.waitForSelector("[role=dialog]");
  assert.equal(await page.getAttribute("[role=dialog] [role=gridcell][aria-selected=true] > *", "aria-label"), "Sunday, February 3, 2019 selected");
  await page.click("[role=dialog] [role=gridcell][aria-selected=true] + [role=gridcell] > *");
  await waitInputText(page, "dp-keep-field", "2/4/2019");
  assert.equal(await page.isVisible("[role=dialog]"), true);
  await page.close();
});

test("datepicker: time granularity — selected date commits with the placeholder time on close", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/date-picker");
  assert.equal(await inputText(page, "dp-time-field"), "mm/dd/yyyy, ––:–– AM");
  await page.click("#dp-time-button");
  await page.waitForSelector("[role=dialog]");
  await page.click("[role=dialog] [role=gridcell] > [aria-label*='February 4, 2019']");
  assert.equal(await page.isVisible("[role=dialog]"), true);
  await page.keyboard.press("Escape");
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  await waitInputText(page, "dp-time-field", "2/4/2019, 12:00 AM");
  await page.close();
});

test("datepicker: Alt+ArrowDown opens; typing fills segments; arrows move between segments", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/date-picker");
  await page.focus("#dp-field [data-type=month]");
  await page.keyboard.type("2");
  // "2" cannot be followed by another digit within 12: focus moves on.
  await waitFocus(page, "#dp-field [data-type=day]");
  await page.keyboard.type("14");
  await waitFocus(page, "#dp-field [data-type=year]");
  await page.keyboard.type("2021");
  await waitInputText(page, "dp-field", "2/14/2021");
  await page.waitForFunction(() => document.getElementById("dp-out")!.textContent === "Value: 2021-02-14");
  await page.keyboard.press("ArrowLeft");
  await waitFocus(page, "#dp-field [data-type=day]");
  await page.keyboard.press("ArrowUp");
  await waitInputText(page, "dp-field", "2/15/2021");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await waitInputText(page, "dp-field", "2/dd/2021");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await waitFocus(page, "#dp-button");
  await page.focus("#dp-field [data-type=month]");
  await page.keyboard.press("Alt+ArrowDown");
  await page.waitForSelector("[role=dialog]");
  await page.close();
});

test("datepicker: disabled — button, segments and hidden input disabled (RAC 'should disable button and date input')", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/date-picker");
  assert.equal(await page.isDisabled("#dp-disabled-button"), true);
  assert.equal(await attr(page, "#dp-disabled", "aria-disabled"), "true");
  for (const value of await page.$$eval("#dp-disabled-field [role=spinbutton]", (els) => els.map((el) => el.getAttribute("aria-disabled"))))
    assert.equal(value, "true");
  assert.equal(await attr(page, "#dp-disabled-field-input", "disabled"), "");
  await page.close();
});

test("datepicker: form value + required native validation (RAC 'form value', 'supports validation errors', 'required state')", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/date-picker");
  assert.equal(await page.evaluate(() => document.getElementById("dp-req")!.closest(".rv-DatePicker")!.hasAttribute("data-required")), true);
  const input = "input[name=date]";
  assert.equal(await attr(page, input, "required"), "");
  assert.equal(await page.$eval(input, (el) => (el as HTMLInputElement).validity.valid), false);
  // Server slot probe: no Description child → no description id (no dangling IDREF on the resumed page).
  assert.equal(await attr(page, "#dp-req", "aria-describedby"), null);
  await page.evaluate(() => (document.getElementById("dp-form") as HTMLFormElement).checkValidity());
  await page.waitForFunction(() => document.getElementById("dp-req")!.closest(".rv-DatePicker")!.hasAttribute("data-invalid"));
  assert.match(await description(page, "#dp-req"), /Please fill out this field|Constraints not satisfied/);
  await waitFocus(page, "#dp-req-field [data-type=month]");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Tab");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Tab");
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction(() => (document.querySelector("input[name=date]") as HTMLInputElement).validity.valid);
  // Still displayed until the field is blurred (commit).
  assert.equal(await page.evaluate(() => document.getElementById("dp-req")!.closest(".rv-DatePicker")!.hasAttribute("data-invalid")), true);
  await page.keyboard.press("Tab");
  await page.waitForFunction(() => !document.getElementById("dp-req")!.closest(".rv-DatePicker")!.hasAttribute("data-invalid"));
  // Only the selected-value description remains (the error is gone).
  assert.equal(await attr(page, "#dp-req", "aria-describedby"), "dp-req-value");
  assert.match(await description(page, "#dp-req"), /^Selected Date: /);
  // Form value: the hidden input carries the ISO string.
  assert.match((await page.$eval(input, (el) => (el as HTMLInputElement).value))!, /^\d{4}-\d{2}-\d{2}$/);
  await page.close();
});

test("datepicker: validation errors from minValue (aria behaviour) render the error message (RAC 'render props' isInvalid)", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/date-picker");
  assert.equal(await page.evaluate(() => document.getElementById("dp-min")!.closest(".rv-DatePicker")!.hasAttribute("data-invalid")), true);
  assert.equal(await attr(page, "#dp-min", "data-invalid"), "true");
  assert.match(await description(page, "#dp-min"), /Too early/);
  await page.close();
});

test("datepicker: autofill through the hidden native date input (RAC 'should support autofill')", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/date-picker");
  await page.fill(".rv-DatePicker:has(#dp) ~ [data-testid=hidden-dateinput-container] input[type=date]", "2000-05-30");
  await waitInputText(page, "dp-field", "5/30/2000");
  await page.close();
});

test("daterangepicker: SSR markup, start / end fields, open + select a range (RAC DateRangePicker 'provides slots', 'close on select')", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  const response = await page.goto(s.origin + "/date-picker");
  const html = await response!.text();
  assert.equal(/rv-RangeCalendar/.test(html), false);
  assert.equal(await inputText(page, "drp-start"), "mm/dd/yyyy");
  assert.equal(await inputText(page, "drp-end"), "mm/dd/yyyy");
  assert.equal(await attr(page, "#drp", "aria-labelledby"), "drp-label");
  assert.equal(await attr(page, "#drp-start [data-type=month]", "aria-label"), "month, Start Date, ");
  assert.equal(await attr(page, "#drp-end [data-type=month]", "aria-label"), "month, End Date, ");
  assert.equal(await attr(page, "#drp-button", "aria-label"), "Calendar");
  await page.click("#drp-button");
  await page.waitForSelector("[role=dialog]");
  assert.equal(await page.evaluate(() => document.querySelector("[role=dialog]")!.closest(".rv-Popover")!.getAttribute("data-trigger")), "DateRangePicker");
  await waitFocus(page, "[role=dialog] [role=grid] [tabindex='0']");
  await page.click("[role=dialog] [role=gridcell] > [aria-label*='February 3, 2019']");
  await page.click("[role=dialog] [role=gridcell] > [aria-label*='February 10, 2019']");
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  await waitInputText(page, "drp-start", "2/3/2019");
  await waitInputText(page, "drp-end", "2/10/2019");
  await page.waitForFunction(() => document.getElementById("drp-out")!.textContent === "Range: 2019-02-03..2019-02-10");
  assert.match(await description(page, "#drp"), /Selected Range: February 3 to 10, 2019|Selected Range: February 3, 2019 to February 10, 2019/);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("daterangepicker: arrows move across both fields; typing commits once both ends are complete", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/date-picker");
  await page.focus("#drp-start [data-type=year]");
  await page.keyboard.press("ArrowRight");
  await waitFocus(page, "#drp-end [data-type=month]");
  await page.keyboard.press("ArrowLeft");
  await waitFocus(page, "#drp-start [data-type=year]");
  await page.focus("#drp-start [data-type=month]");
  await page.keyboard.type("3");
  await page.keyboard.type("4");
  await page.keyboard.type("2020");
  // Typing the year's last digit moves on to the end field.
  await waitFocus(page, "#drp-end [data-type=month]");
  await page.keyboard.type("3");
  await page.keyboard.type("9");
  await page.keyboard.type("2020");
  await page.waitForFunction(() => document.getElementById("drp-out")!.textContent === "Range: 2020-03-04..2020-03-09");
  await page.close();
});

test("daterangepicker: required — both inputs required, invalid on checkValidity until both ends are filled (RAC DateRangePicker 'supports validation errors')", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/date-picker");
  const root = () => page.evaluate(() => document.getElementById("drp-req")!.closest(".rv-DateRangePicker")!.hasAttribute("data-invalid"));
  const valid = (name: string) => page.$eval(`input[name=${name}]`, (el) => (el as HTMLInputElement).validity.valid);
  assert.equal(await attr(page, "input[name=from]", "required"), "");
  assert.equal(await attr(page, "input[name=to]", "required"), "");
  assert.equal(await valid("from"), false);
  assert.equal(await valid("to"), false);
  // Server slot probe: no Description child → no description id (no dangling IDREF on the resumed page).
  assert.equal(await attr(page, "#drp-req", "aria-describedby"), null);
  assert.equal(await root(), false);
  await page.evaluate(() => (document.getElementById("drp-form") as HTMLFormElement).checkValidity());
  await page.waitForFunction(() => document.getElementById("drp-req")!.closest(".rv-DateRangePicker")!.hasAttribute("data-invalid"));
  assert.match(await description(page, "#drp-req"), /Please fill out this field|Constraints not satisfied/);
  await waitFocus(page, "#drp-req-start [data-type=month]");
  for (const key of ["ArrowUp", "Tab", "ArrowUp", "Tab", "ArrowUp", "Tab", "ArrowUp", "Tab", "ArrowUp", "Tab", "ArrowUp"]) await page.keyboard.press(key);
  await page.waitForFunction(() => (document.querySelector("input[name=to]") as HTMLInputElement).validity.valid);
  assert.equal(await valid("from"), true);
  assert.equal(await root(), true);
  await page.keyboard.press("Tab");
  await page.waitForFunction(() => !document.getElementById("drp-req")!.closest(".rv-DateRangePicker")!.hasAttribute("data-invalid"));
  assert.doesNotMatch(await description(page, "#drp-req"), /Please fill out this field|Constraints not satisfied/);
  await page.close();
});

test("daterangepicker: form value, close on select true / false (RAC DateRangePicker 'form value', 'close on select')", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/date-picker");
  assert.equal(await page.$eval("input[name=s]", (el) => (el as HTMLInputElement).value), "2023-01-10");
  assert.equal(await attr(page, "input[name=s]", "form"), "test");
  assert.equal(await page.$eval("input[name=e]", (el) => (el as HTMLInputElement).value), "2023-01-20");
  assert.equal(await attr(page, "input[name=e]", "form"), "test");
  for (const [id, closes] of [
    ["drp-sel", true],
    ["drp-keep", false],
  ] as const) {
    await page.click(`#${id}-button`);
    await page.waitForSelector("[role=dialog]");
    assert.equal(
      await page.getAttribute("[role=dialog] [role=gridcell][aria-selected=true] > *", "aria-label"),
      "Selected Range: Tuesday, January 10 to Friday, January 20, 2023, Tuesday, January 10, 2023 selected",
    );
    await page.click("[role=dialog] [role=gridcell][aria-selected=true] + [role=gridcell] > *");
    await page.click("[role=dialog] [role=gridcell] > [aria-label*='January 13, 2023']");
    if (closes) await page.waitForSelector("[role=dialog]", { state: "detached" });
    else {
      await waitInputText(page, `${id}-end`, "1/13/2023");
      assert.equal(await page.isVisible("[role=dialog]"), true);
      await page.keyboard.press("Escape");
      await page.waitForSelector("[role=dialog]", { state: "detached" });
    }
    await waitInputText(page, `${id}-start`, "1/11/2023");
    await waitInputText(page, `${id}-end`, "1/13/2023");
  }
  await page.close();
});

test("daterangepicker: sets a placeholder time when closing (RAC DateRangePicker 'should set a placeholder time when closing')", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/date-picker");
  await page.click("#drp-time-button");
  await page.waitForSelector("[role=dialog]");
  await page.click("[role=dialog] [role=gridcell] > [aria-label*='January 6, 2023']");
  await page.click("[role=dialog] [role=gridcell] > [aria-label*='January 11, 2023']");
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  const normalize = (s: string) => s.replace(/\s/g, " ").replace(/[\u2066\u2069]/g, "");
  await waitInputText(page, "drp-time-start", normalize(new Date(2023, 0, 6).toLocaleString("en-US")));
  assert.equal(normalize(await inputText(page, "drp-time-end")), normalize(new Date(2023, 0, 11).toLocaleString("en-US")));
  await page.close();
});

test("daterangepicker: disabled (RAC DateRangePicker 'should disable button and date input')", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/date-picker");
  assert.equal(await page.isDisabled("#drp-disabled-button"), true);
  assert.equal(await attr(page, "#drp-disabled", "aria-disabled"), "true");
  for (const value of await page.$$eval("#drp-disabled [role=spinbutton]", (els) => els.map((el) => el.getAttribute("aria-disabled"))))
    assert.equal(value, "true");
  await page.close();
});

test("datefield: standalone DateField group with value description", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/date-picker");
  assert.equal(await attr(page, "#df", "role"), "group");
  assert.equal(await inputText(page, "df"), "2/3/2020");
  assert.match(await description(page, "#df"), /Selected Date: February 3, 2020/);
  await page.focus("#df [data-type=day]");
  await page.keyboard.press("ArrowUp");
  await waitInputText(page, "df", "2/4/2020");
  await page.keyboard.press("ArrowRight");
  await waitFocus(page, "#df [data-type=year]");
  await page.close();
});
