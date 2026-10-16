// Select: ported from react-aria-components test/Select.test.js and react-aria
// test/select/HiddenSelect.test.tsx (Apache-2.0, © Adobe), run against the resumed production story
// build (/select). RAC composes <Label>, <Button>, <SelectValue>, <Popover>, <ListBox>; the cdk Select
// renders the same parts from props (data-driven items), so each case drives the equivalent story.
// Cases about React context / slots / render functions of the DOM element have no equivalent (see
// the notes at the end). Expected texts are the originals except Chromium's native validation messages.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Browser, Page } from "playwright";
import { stories, watch, libraryScripts, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function open(path = "/select", options: Parameters<Browser["newContext"]>[0] = {}): Promise<Page> {
  const context = await s.browser.newContext(options);
  const page = await context.newPage();
  await page.goto(s.origin + path);
  return page;
}

const trigger = (id: string) => `#${id}-trigger`;
const listbox = (id: string) => `#${id}-listbox`;
const options = (id: string) => `#${id}-listbox [role=option]`;
const norm = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();
const textOf = async (page: Page, selector: string) => norm(await page.textContent(selector));
const until = (page: Page, selector: string, value: string) =>
  page
    .waitForFunction(
      ([selector, value]) => (document.querySelector(selector!)?.textContent ?? "").replace(/\s+/g, " ").trim() === value,
      [selector, value] as const,
      {
        timeout: 5000,
      },
    )
    .catch(async () => assert.equal(await textOf(page, selector), value));
const isOpen = (page: Page, id: string) => page.evaluate((id) => document.getElementById(id + "-listbox") != null, id);
const waitOpen = (page: Page, id: string, open = true) =>
  page.waitForFunction(
    ([id, open]) => (document.getElementById(id + "-listbox") != null && !document.getElementById(id + "-popover")?.hasAttribute("data-exiting")) === open,
    [id, open] as const,
    {
      timeout: 5000,
    },
  );
const focusedId = (page: Page, id: string) => page.waitForFunction((id) => document.activeElement?.id === id, id, { timeout: 5000 });
/** SelectTester.open (mouse): press the trigger, wait for the listbox it controls. */
async function openSelect(page: Page, id: string): Promise<void> {
  await page.click(trigger(id));
  await waitOpen(page, id);
  await page.waitForFunction((id) => document.getElementById(id + "-trigger")?.getAttribute("aria-controls") === id + "-listbox", id);
}
/** SelectTester.toggleOptionSelection (mouse): open if needed, click the option by text. */
async function toggleOption(page: Page, id: string, text: string): Promise<void> {
  if (!(await isOpen(page, id))) await openSelect(page, id);
  await page
    .locator(options(id), { hasText: new RegExp(`^${text}`) })
    .first()
    .click();
}
const log = (page: Page) => textOf(page, "#select-log");
const formData = (page: Page, form: string, name: string) =>
  page.evaluate(([form, name]) => new FormData(document.getElementById(form!) as HTMLFormElement).getAll(name!).map(String), [form, name] as const);

test("provides slots (label, value, description, popover + listbox), nothing shipped or rendered before interaction", async () => {
  const page = await open();
  const seen = watch(page);
  await page.reload();
  const t = trigger("animal");
  assert.equal(await textOf(page, t), "Select an item");
  assert.equal(await page.getAttribute(t, "data-pressed"), null);
  assert.equal(await page.getAttribute(t, "aria-haspopup"), "listbox");
  assert.equal(await page.getAttribute(t, "aria-expanded"), "false");
  assert.equal(await page.locator(listbox("animal")).count(), 0, "closed: the popover renders nothing");
  assert.equal(await page.getAttribute("#animal", "class"), "rv-Select");
  const [valueId, labelId] = (await page.getAttribute(t, "aria-labelledby"))!.split(" ");
  assert.equal(await page.getAttribute(`#${labelId}`, "class"), "rv-Label");
  assert.equal(await textOf(page, `#${labelId}`), "Favorite Animal");
  assert.equal(await page.getAttribute(`#${valueId}`, "class"), "rv-SelectValue");
  assert.equal(await textOf(page, `#${valueId}`), "Select an item");
  const described = await page.evaluate(
    (t) =>
      document
        .querySelector(t)!
        .getAttribute("aria-describedby")!
        .split(" ")
        .map((id) => document.getElementById(id)!.textContent)
        .join(" "),
    t,
  );
  // RAC renders the errorMessage Text slot unconditionally ("Description Error"); the cdk field error shows while invalid.
  assert.equal(described, "Description");
  assert.deepEqual(libraryScripts(seen), [], "no library code before interaction");

  await openSelect(page, "animal");
  assert.equal(await page.getAttribute(t, "data-pressed"), "true");
  assert.equal(await page.getAttribute(listbox("animal"), "class"), "rv-ListBox");
  assert.equal(await page.evaluate(() => document.getElementById("animal-listbox")!.closest(".rv-Select-popover")?.getAttribute("data-trigger")), "Select");
  assert.equal(await page.locator(options("animal")).count(), 3);
  await page.locator(options("animal")).nth(1).click();
  await until(page, t, "Dog");
  await waitOpen(page, "animal", false);
  await focusedId(page, "animal-trigger");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("supports items with render props, custom select value, placeholder", async () => {
  const page = await open();
  assert.equal(await textOf(page, trigger("render-item")), "Cat");
  await openSelect(page, "render-item");
  assert.equal(await textOf(page, "#render-item-listbox-option-cat"), "Cat (selected)");
  await page.keyboard.press("Escape");
  await waitOpen(page, "render-item", false);
  assert.equal(await textOf(page, trigger("custom-value")), "1 - Cat");
  assert.equal(await textOf(page, trigger("placeholder")), "Select an animal");
  await page.close();
});

test("should support empty state", async () => {
  const page = await open();
  await openSelect(page, "empty");
  assert.equal(await page.getAttribute(listbox("empty"), "data-empty"), "true");
  assert.equal(await textOf(page, options("empty")), "No results");
  await page.close();
});

test("should support render props", async () => {
  const page = await open();
  assert.equal(await textOf(page, trigger("render-props")), "Select an itemopen");
  await openSelect(page, "render-props");
  await until(page, trigger("render-props"), "Select an itemclose");
  await page.close();
});

test("should stay open on selecting an option if shouldCloseOnSelect is false and single selection mode", async () => {
  const page = await open();
  await openSelect(page, "stay-open");
  assert.equal(await page.getAttribute(trigger("stay-open"), "data-pressed"), "true");
  await toggleOption(page, "stay-open", "Dog");
  await until(page, trigger("stay-open"), "Dog");
  assert.equal(await page.getAttribute(trigger("stay-open"), "data-pressed"), "true");
  assert.equal(await isOpen(page, "stay-open"), true);
  await page.close();
});

test("should close on selecting an option if shouldCloseOnSelect is true and multiple selection mode", async () => {
  const page = await open();
  await openSelect(page, "close-multi");
  await toggleOption(page, "close-multi", "Dog");
  await until(page, trigger("close-multi"), "Dog");
  await waitOpen(page, "close-multi", false);
  assert.equal(await page.getAttribute(trigger("close-multi"), "data-pressed"), null);
  await page.close();
});

test("should send disabled prop to the hidden field; form prop", async () => {
  const page = await open();
  assert.equal(await page.locator("[name=disabledsel]").isDisabled(), true);
  assert.equal(await page.locator(trigger("disabled")).isDisabled(), true);
  assert.equal(await page.getAttribute("#disabled", "data-disabled"), "true");
  assert.equal(await page.getAttribute("[name=formsel]", "form"), "test");
  await page.close();
});

test("supports validation errors", async () => {
  const page = await open();
  const t = trigger("required");
  assert.equal(await page.getAttribute("[name=required]", "required"), "");
  assert.equal(await page.getAttribute(t, "aria-describedby"), null);
  assert.equal(await page.evaluate(() => (document.querySelector("[name=required]") as HTMLSelectElement).validity.valid), false);
  assert.equal(await page.getAttribute("#required", "data-invalid"), null);
  const message = await page.evaluate(() => {
    (document.getElementById("validation-form") as HTMLFormElement).checkValidity();
    return (document.querySelector("[name=required]") as HTMLSelectElement).validationMessage;
  });
  await page.waitForFunction(() => document.querySelector("#required-trigger")?.hasAttribute("aria-describedby"));
  // RAC (jsdom): "Constraints not satisfied"; Chromium: its own message.
  assert.equal(await textOf(page, `#${await page.getAttribute(t, "aria-describedby")}`), message);
  assert.ok(message.length > 0);
  assert.equal(await page.getAttribute("#required", "data-invalid"), "true");
  await focusedId(page, "required-trigger");
  await toggleOption(page, "required", "Cat");
  await page.waitForFunction(() => !document.querySelector("#required-trigger")?.hasAttribute("aria-describedby"));
  assert.equal(await page.getAttribute("#required", "data-invalid"), null);
  await page.close();
});

test("should support arrow key navigation to a falsy key", async () => {
  const page = await open();
  await page.focus(trigger("numbers"));
  await page.keyboard.press("ArrowRight");
  await until(page, trigger("numbers"), "0");
  assert.equal(await log(page), "change:0 pick:0");
  await page.close();
});

test("should support repeat keydown events when holding an arrow key", async () => {
  const page = await open();
  await page.focus(trigger("numbers"));
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("ArrowRight"); // repeat
  await page.keyboard.up("ArrowRight");
  await until(page, trigger("numbers"), "1");
  assert.match(await log(page), /change:1 pick:1$/);
  await page.close();
});

test("should support falsy (0) as a valid default value", async () => {
  const page = await open();
  await openSelect(page, "falsy");
  await page.locator(options("falsy")).first().click();
  await until(page, trigger("falsy"), "0");
  await page.close();
});

test("should support extra children for use with the state", async () => {
  const page = await open();
  await page.focus("#before");
  await page.keyboard.press("Tab");
  await focusedId(page, "clearable-trigger");
  await page.keyboard.press("Tab");
  await focusedId(page, "clear");
  await page.keyboard.press("Tab");
  await focusedId(page, "after");
  await page.keyboard.press("Shift+Tab");
  await focusedId(page, "clear");
  await page.keyboard.press("Shift+Tab");
  await focusedId(page, "clearable-trigger");
  await page.keyboard.press("Shift+Tab");
  await focusedId(page, "before");
  await toggleOption(page, "clearable", "Dog");
  await until(page, "#select-log", "sel:dog");
  await page.click("#clear");
  await until(page, "#select-log", "sel:dog sel:null");
  await until(page, trigger("clearable"), "Select an item");
  await page.close();
});

test("select can select an option via keyboard", async () => {
  const page = await open();
  const t = trigger("animal");
  assert.equal(await textOf(page, t), "Select an item");
  await page.focus(t);
  await page.keyboard.press("Enter");
  await waitOpen(page, "animal");
  // Opened with the keyboard: focus goes to the first item.
  await focusedId(page, "animal-listbox-option-cat");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await focusedId(page, "animal-listbox-option-kangaroo");
  await page.keyboard.press("Enter");
  await until(page, t, "Kangaroo");
  await waitOpen(page, "animal", false);
  await focusedId(page, "animal-trigger");
  // ArrowUp opens on the last item, the selected one wins.
  await page.keyboard.press("ArrowUp");
  await focusedId(page, "animal-listbox-option-kangaroo");
  await page.keyboard.press("Escape");
  await waitOpen(page, "animal", false);
  await focusedId(page, "animal-trigger");
  await page.close();
});

test("Tab / Shift+Tab in the open listbox keep focus inside the (modal) popover", async () => {
  const page = await open();
  for (const how of ["keyboard", "mouse"]) {
    if (how === "keyboard") {
      await page.focus(trigger("animal"));
      await page.keyboard.press("ArrowDown");
    } else await page.click(trigger("animal"));
    await page.waitForSelector(options("animal"));
    await page.waitForFunction((id) => !!document.activeElement?.closest(id), listbox("animal"));
    for (const key of ["Tab", "Shift+Tab"]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(100);
      assert.ok(await page.evaluate((id) => !!document.activeElement?.closest(id), listbox("animal")), how + " " + key + ": focus stays in the listbox");
      assert.equal(await page.locator(listbox("animal")).count(), 1, "still open");
    }
    await page.keyboard.press("Escape");
    await page.waitForSelector(listbox("animal"), { state: "detached" });
  }
  await page.close();
});

test("typeahead: can select an option via typeahead (closed trigger)", async () => {
  const page = await open();
  await page.focus(trigger("typeahead"));
  await page.keyboard.type("Northern Terr");
  await until(page, trigger("typeahead"), "Northern Territory");
  assert.equal(await page.getAttribute(trigger("typeahead"), "data-pressed"), null);
  assert.equal(await isOpen(page, "typeahead"), false);
  await page.close();
});

test("should support autoFocus", async () => {
  const page = await open("/select-autofocus");
  await focusedId(page, "auto-trigger");
  await page.close();
});

test("shouldn't allow the user to open the select if there are no items", async () => {
  const page = await open();
  await page.click(trigger("no-items"));
  await page.waitForTimeout(100);
  assert.equal(await page.locator("#no-items-popover").count(), 0);
  assert.equal(await page.getAttribute(trigger("no-items"), "aria-expanded"), "false");
  await page.close();
});

test("should not submit if required and selectedKey is null", async () => {
  const page = await open();
  const t = trigger("submit");
  assert.equal(await textOf(page, t), "Select an item");
  await toggleOption(page, "submit", "Cat");
  await until(page, t, "Cat");
  // Warm the <Form> submit chunk first: a cold submit is replayed with `defaultPrevented` already true
  // (the loader held it), so <Form> skips `onSubmit` and the replay submits natively (runtime issue).
  await page.hover("#submit-button");
  await page.waitForLoadState("networkidle");
  await page.click("#submit-button");
  await until(page, "#select-submits", "1");
  await page.click("#submit-clear");
  await until(page, t, "Select an item");
  await page.click("#submit-button");
  await page.waitForTimeout(100);
  assert.equal(await textOf(page, "#select-submits"), "1");
  assert.equal(await page.evaluate(() => (document.querySelector("[name=submit]") as HTMLSelectElement).value), "");
  await page.close();
});

test("should support multiple selection", async () => {
  const page = await open();
  const t = trigger("multi");
  assert.equal(await textOf(page, t), "Select an item");
  await openSelect(page, "multi");
  assert.equal(await page.getAttribute(listbox("multi"), "aria-multiselectable"), "true");
  assert.equal(await page.locator(options("multi")).count(), 3);
  await page.locator(options("multi")).nth(0).click();
  await page.locator(options("multi")).nth(1).click();
  await until(page, t, "Cat and Dog");
  await page.keyboard.press("Escape");
  await waitOpen(page, "multi", false);
  await focusedId(page, "multi-trigger");
  assert.equal(await log(page), "multi:[cat] multi:[cat,dog]");
  assert.deepEqual(await formData(page, "multi-form", "multi"), ["cat", "dog"]);
  await page.close();
});

test("should support deselection if multiple selection is enabled", async () => {
  const page = await open();
  await toggleOption(page, "multi", "Cat");
  await toggleOption(page, "multi", "Dog");
  const selected = () => page.$$eval(options("multi"), (els) => els.map((el) => el.getAttribute("aria-selected")));
  await page.waitForFunction(() => document.querySelectorAll("#multi-listbox [aria-selected=true]").length === 2);
  assert.deepEqual(await selected(), ["true", "true", "false"]);
  assert.match(await log(page), /multi:\[cat,dog\]$/);
  await toggleOption(page, "multi", "Cat");
  await page.waitForFunction(() => document.querySelectorAll("#multi-listbox [aria-selected=true]").length === 1);
  assert.deepEqual(await selected(), ["false", "true", "false"]);
  assert.match(await log(page), /multi:\[dog\]$/);
  await toggleOption(page, "multi", "Dog");
  await page.waitForFunction(() => document.querySelectorAll("#multi-listbox [aria-selected=true]").length === 0);
  assert.deepEqual(await selected(), ["false", "false", "false"]);
  assert.match(await log(page), /multi:\[\]$/);
  await page.keyboard.press("Escape");
  await waitOpen(page, "multi", false);
  await page.close();
});

test("should support multiple selection form integration with many items", async () => {
  const page = await open();
  const t = trigger("many");
  assert.equal(await textOf(page, t), "Select an item");
  await page.click("#many-submit");
  await page.waitForFunction(() => document.getElementById("many-trigger-error") != null);
  const message = await page.evaluate(() => (document.querySelector("input[name=many]") as HTMLInputElement).validationMessage);
  // RAC (jsdom): "Constraints not satisfied".
  assert.equal(await textOf(page, "#many-trigger-error"), message);
  await openSelect(page, "many");
  await page.locator(options("many")).nth(0).click();
  await page.locator(options("many")).nth(1).click();
  await page.keyboard.press("Escape");
  await waitOpen(page, "many", false);
  await until(page, t, "item0 and item1");
  assert.deepEqual(await formData(page, "many-form", "many"), ["0", "1"]);
  await page.click("#many-submit");
  // RAC FieldError: nothing renders while valid.
  await page.waitForFunction(() => document.getElementById("many-trigger-error") == null);
  await page.close();
});

test("should support controlled multi-selection; custom select value with multi-selection", async () => {
  const page = await open();
  assert.equal(await textOf(page, trigger("controlled-multi")), "Dog and Kangaroo");
  await openSelect(page, "controlled-multi");
  assert.deepEqual(await page.$$eval(options("controlled-multi"), (els) => els.map((el) => el.getAttribute("aria-selected"))), ["false", "true", "true"]);
  await page.keyboard.press("Escape");
  await waitOpen(page, "controlled-multi", false);
  assert.equal(await textOf(page, trigger("custom-multi")), "Cat");
  await toggleOption(page, "custom-multi", "Dog");
  await until(page, trigger("custom-multi"), "2 selected items");
  await page.close();
});

test("has a value immediately after rendering (server-rendered hidden select, no JavaScript)", async () => {
  const page = await open("/select", { javaScriptEnabled: false });
  await page.click("#immediate-submit");
  await page.waitForURL(/immediate=1/);
  assert.equal(new URL(page.url()).searchParams.get("immediate"), "1");
  await page.close();
});

// RAC test/Select.ssr.test.js
test("SSR: should render text of default selected key", async () => {
  const server = await open("/select", { javaScriptEnabled: false });
  assert.equal(await textOf(server, trigger("render-item")), "Cat");
  await server.close();
  const page = await open();
  await openSelect(page, "render-item");
  await page.keyboard.press("Escape");
  await waitOpen(page, "render-item", false);
  assert.equal(await textOf(page, trigger("render-item")), "Cat");
  await page.close();
});

// --- Rivet regressions (no upstream case) -------------------------------------------------------

test("the listbox follows a value changed outside, also when opened through isOpen", async () => {
  const page = await open();
  assert.equal(await textOf(page, trigger("external")), "Cat");
  await page.click("#external-dog");
  await until(page, trigger("external"), "Dog");
  await page.click("#external-open");
  await waitOpen(page, "external");
  const selected = () => page.$$eval(options("external"), (els) => els.map((el) => el.getAttribute("aria-selected")));
  assert.deepEqual(await selected(), ["false", "true", "false"]);
  await page.keyboard.press("Escape");
  await waitOpen(page, "external", false);
  await page.close();
});

test("focus events fire once per focus, not when the listbox takes focus; data-focused stays while open", async () => {
  const page = await open();
  await page.focus(trigger("focus-events"));
  await until(page, "#select-log", "focus change:true");
  await page.keyboard.press("Enter");
  await waitOpen(page, "focus-events");
  await focusedId(page, "focus-events-listbox-option-cat");
  assert.equal(await page.getAttribute("#focus-events", "data-focused"), "true");
  await page.keyboard.press("ArrowDown");
  await focusedId(page, "focus-events-listbox-option-dog");
  await page.keyboard.press("Enter");
  await waitOpen(page, "focus-events", false);
  await focusedId(page, "focus-events-trigger");
  assert.equal(await page.getAttribute("#focus-events", "data-focused"), "true");
  await openSelect(page, "focus-events");
  await page.keyboard.press("Escape");
  await waitOpen(page, "focus-events", false);
  await focusedId(page, "focus-events-trigger");
  assert.equal(await log(page), "focus change:true");
  await page.focus("#after");
  await until(page, "#select-log", "focus change:true blur change:false");
  assert.equal(await page.getAttribute("#focus-events", "data-focused"), null);
  await page.close();
});

test("plain controlled value (RAC controlled prop): a pick calls onChange, the shown value stays the prop", async () => {
  const page = await open();
  assert.equal(await textOf(page, trigger("plain-controlled")), "Dog");
  await toggleOption(page, "plain-controlled", "Cat");
  await until(page, "#select-log", "plain:cat");
  await waitOpen(page, "plain-controlled", false);
  assert.equal(await textOf(page, trigger("plain-controlled")), "Dog");
  await page.close();
});

test("renders without items (RAC parts mode, no data collection): no throw, placeholder shown", async () => {
  const page = await open();
  assert.equal(await textOf(page, trigger("no-items")), "Select an item");
  await page.close();
});

test("selected items rendered outside: removeSelected / clearSelection update the value, trigger and listbox", async () => {
  const page = await open();
  const items = () => page.$$eval("#chips-list li span", (els) => els.map((el) => el.textContent));
  assert.deepEqual(await items(), ["Cat", "Dog"]);
  assert.equal(await textOf(page, trigger("chips")), "Cat and Dog");
  await page.click("#chips-list [data-remove=cat]");
  await until(page, trigger("chips"), "Dog");
  assert.deepEqual(await items(), ["Dog"]);
  await openSelect(page, "chips");
  assert.deepEqual(await page.$$eval(options("chips"), (els) => els.map((el) => el.getAttribute("aria-selected"))), ["false", "true", "false"]);
  await toggleOption(page, "chips", "Kangaroo");
  await until(page, trigger("chips"), "Dog and Kangaroo");
  assert.equal(await isOpen(page, "chips"), true, "multiple stays open after a pick");
  await page.keyboard.press("Escape");
  await waitOpen(page, "chips", false);
  assert.deepEqual(await items(), ["Dog", "Kangaroo"]);
  await page.click("#chips-clear");
  await until(page, trigger("chips"), "Select an item");
  assert.deepEqual(await items(), []);
  await page.close();
});

// --- HiddenSelect (react-aria test/select/HiddenSelect.test.tsx) ---------------------------------

test("HiddenSelect: renders for collection.size <= 300 with no selected key, and > 300 with a name", async () => {
  const page = await open();
  assert.equal(await page.locator("#hidden5-hidden option").count(), 6);
  assert.equal(await page.locator("#hidden-form-400 input[name=select]").count(), 1);
  assert.equal(await page.getAttribute("#hidden-form-400 input[name=select]", "type"), "hidden");
  assert.equal(await page.locator("#hidden-form-400 select").count(), 0);
  await page.close();
});

test("HiddenSelect: should have form value after initial render", async () => {
  const page = await open();
  assert.deepEqual(await formData(page, "hidden-form-empty", "select"), ["value"]);
  await page.close();
});

test("HiddenSelect: should trigger onSelectionChange when select onchange is triggered (autofill)", async () => {
  const page = await open();
  // getByLabelText: the <label> wrapping the select (the container is aria-hidden, so not by role).
  assert.equal(
    await page.evaluate(() => (document.getElementById("hidden5-hidden") as HTMLSelectElement).labels[0]?.textContent?.trim().startsWith("select")),
    true,
  );
  await page.locator("#hidden5-hidden").selectOption("5");
  await until(page, "#select-log", "autofill:5");
  await page.close();
});

test("HiddenSelect: non-empty placeholder option, empty submitted value, data attributes", async () => {
  const page = await open();
  const first = page.locator("#hidden5-hidden option").first();
  assert.equal(await first.getAttribute("value"), "");
  assert.equal(await first.getAttribute("label"), " ");
  assert.deepEqual(await formData(page, "hidden-form-5", "select"), [""]);
  const container = page.locator("#hidden-select [data-testid=hidden-select-container]").first();
  assert.equal(await container.getAttribute("data-a11y-ignore"), "aria-hidden-focus");
  assert.equal(await container.getAttribute("data-react-aria-prevent-focus"), "");
  assert.equal(await container.getAttribute("aria-hidden"), "true");
  await page.close();
});

// Not ported (React-only API): "should support slot" (SelectContext slots), "should support custom
// render function" (`render` prop of the DOM element), "should render data- attributes only on the
// outer element" (no DOM prop spreading), "should clear contexts inside popover" (no contexts: the
// popover holds only the listbox), "should not throw when rendered inside a Dialog / alertdialog with
// a Text errorMessage slot" (no Text slots).
