// Global DOM events / attributes (react-aria-components GlobalDOMAttributes) on the form, field and
// navigation components, against the resumed story app (/dom-events-forms).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const logHas = (page: Page, entry: string) =>
  page.waitForFunction((entry) => document.querySelector("#fx-log")!.textContent!.split(" ").includes(entry), entry, { timeout: 5000 });
/** Waits for `entry` to be logged more than `before` times (`before` = count before the action). */
const count = (page: Page, entry: string) => page.$eval("#fx-log", (el, entry) => el.textContent!.split(" ").filter((e) => e === entry).length, entry);
const logMore = (page: Page, entry: string, before: number) =>
  page.waitForFunction(
    ([entry, before]) =>
      document
        .querySelector("#fx-log")!
        .textContent!.split(" ")
        .filter((e) => e === entry).length > (before as number),
    [entry, before] as const,
    {
      timeout: 5000,
    },
  );
const state = (page: Page) => page.textContent("#fx-state").then((t) => t!.replace(/\s+/g, " ").trim());
const L = (tag: string) => `[lang="en-x-${tag}"]`;

async function open(): Promise<{ page: Page; seen: ReturnType<typeof watch> }> {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/dom-events-forms");
  return { page, seen };
}

test("dom-events forms: attributes land on each root element (and parts), untouched markup otherwise", async () => {
  const { page, seen } = await open();
  const roots: [string, string][] = [
    ["tb", "BUTTON"],
    ["cb", "LABEL"],
    ["cbg", "DIV"],
    ["cbi", "LABEL"],
    ["sw", "LABEL"],
    ["rg", "DIV"],
    ["ri", "LABEL"],
    ["tf", "DIV"],
    ["ta", "DIV"],
    ["lb", "LABEL"],
    ["tx", "P"],
    ["fe", "SPAN"],
    ["fm", "FORM"],
    ["gr", "DIV"],
    ["ln", "SPAN"],
    ["bc", "OL"],
    ["bci", "LI"],
    ["tl", "DIV"],
    ["ds", "DETAILS"],
  ];
  for (const [tag, element] of roots) assert.equal(await page.$eval(L(tag), (el) => el.tagName), element, tag);
  assert.equal(await page.getAttribute("#fx-tb", "dir"), "ltr");
  assert.equal(await page.$eval(L("cbg"), (el) => el.getAttribute("role")), "group");
  assert.equal(await page.$eval(L("rg"), (el) => el.getAttribute("role")), "radiogroup");
  assert.equal(await page.$eval(L("tl"), (el) => el.getAttribute("role")), "toolbar");
  // FieldError keeps its own `hidden` (shown: has an error).
  assert.equal(await page.$eval(L("fe"), (el) => el.hasAttribute("hidden")), false);
  // Items without DOM props render no extra attributes.
  assert.equal(await page.$eval('input[value="b"]', (el) => el.closest("label")!.getAttributeNames().includes("lang")), false);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("dom-events forms: ToggleButton forwards global events, chains owned pointerdown/click with the toggle", async () => {
  const { page, seen } = await open();
  await page.hover("#fx-tb");
  await logHas(page, "tb-enter");
  await page.click("#fx-tb");
  await logHas(page, "tb-click");
  await logHas(page, "tb-down");
  await logHas(page, "tb-focus:true");
  assert.match(await state(page), /^pinned/);
  assert.equal(await page.getAttribute("#fx-tb", "aria-pressed"), "true");
  await page.dblclick("#fx-tb");
  await logHas(page, "tb-dbl");
  await page.keyboard.press("a");
  await logHas(page, "tb-keyup:a");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("dom-events forms: Checkbox / CheckboxGroup item / Switch: global events on the label, mousedown chained, focus on the input", async () => {
  const { page, seen } = await open();
  await page.click(L("cb"), { button: "right" });
  await logHas(page, "cb-menu");
  // Label mousedown: RAC mergeProps(DOMProps, labelProps, …) runs the user's handler first, then RA useCheckbox's
  // preventDefault (keeps focus off the label), so the user's handler sees `defaultPrevented` false.
  const cbDowns = await count(page, "cb-mdown:false");
  await page.dispatchEvent(L("cb"), "mousedown", { bubbles: true, cancelable: true });
  await logMore(page, "cb-mdown:false", cbDowns);
  // The input is visually hidden: click the label (native activation focuses and toggles the input).
  await page.click(L("cb"));
  await logHas(page, "cb-focus:true");
  assert.match(await state(page), /unpinned checked/);
  await page.keyboard.press("x");
  await logHas(page, "cb-key:x");

  await page.dispatchEvent(L("cbg"), "wheel", { bubbles: true });
  await logHas(page, "cbg-wheel");
  await page.dblclick(L("cbi"));
  await logHas(page, "cbi-dbl");
  const cbiDowns = await count(page, "cbi-mdown:false");
  await page.dispatchEvent(L("cbi"), "mousedown", { bubbles: true, cancelable: true });
  await logMore(page, "cbi-mdown:false", cbiDowns);
  await page.focus('input[value="a"]');
  await logHas(page, "cbi-focus");
  await page.keyboard.press("y");
  await logHas(page, "cbi-keyup:y");

  await page.hover(L("sw"));
  await logHas(page, "sw-enter");
  // RA useSwitch (useToggle) has no label mousedown handler.
  const swDowns = await count(page, "sw-mdown:false");
  await page.dispatchEvent(L("sw"), "mousedown", { bubbles: true, cancelable: true });
  await logMore(page, "sw-mdown:false", swDowns);
  await page.click(L("sw"));
  await logHas(page, "sw-focus:true");
  assert.match(await state(page), / on /);
  await page.focus("#fx-tb");
  await logHas(page, "sw-focus:false");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("dom-events forms: RadioGroup (focus-within) and Radio item events", async () => {
  const { page, seen } = await open();
  // A cold dblclick: the first mousedown defaults (focus leaves the radio the first click focused) land before the
  // chunk with RA useRadio's label `preventDefault` loads — a cold-page gap (no loader hold for mousedown), so the
  // focus-within assertions below only look at the log after the page is warm.
  await page.dblclick(L("rg"));
  await logHas(page, "rg-dbl");
  await page.click(L("ri"), { button: "right" });
  await logHas(page, "ri-menu");
  await page.waitForLoadState("networkidle");
  const warm = (await page.textContent("#fx-log"))!.length;
  // Warm: a label mousedown keeps focus in the group (RA useRadio label onMouseDown preventDefault).
  await page.focus("#fx-ri2");
  await page.dblclick(L("rg"));
  assert.equal(await page.evaluate(() => document.activeElement?.id), "fx-ri2");
  await page.focus("#fx-ri");
  await logHas(page, "rg-focus:true");
  await logHas(page, "ri-focus:true");
  await page.keyboard.press("ArrowDown");
  await logHas(page, "ri-key:ArrowDown");
  await logHas(page, "ri-focus:false");
  // Focus moved inside the group: no group blur.
  assert.equal((await page.textContent("#fx-log"))!.slice(warm).includes("rg-focus:false"), false);
  await page.focus("#fx-tb");
  await logHas(page, "rg-focus:false");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("dom-events forms: TextField / TextArea: global events on the wrapper, text input events on the input, onInput chained", async () => {
  const { page, seen } = await open();
  await page.hover(L("tf"));
  await logHas(page, "tf-enter");
  await page.click("#fx-tf");
  await logHas(page, "tf-focus:true");
  await page.keyboard.type("a");
  await logHas(page, "tf-before");
  // The field's own input handler ran first: the value signal is already updated.
  await logHas(page, "tf-input:a:a");
  assert.match(await state(page), /\[a\]/);
  await page.dispatchEvent("#fx-tf", "paste", { bubbles: true });
  await logHas(page, "tf-paste");
  await page.dispatchEvent("#fx-tf", "copy", { bubbles: true });
  await logHas(page, "tf-copy");
  await page.dispatchEvent("#fx-tf", "select", { bubbles: true });
  await logHas(page, "tf-select");
  await page.dispatchEvent("#fx-tf", "compositionstart", { bubbles: true });
  await logHas(page, "tf-comp");
  await page.dblclick(L("ta") + " label");
  await logHas(page, "ta-dbl");
  await page.fill("#fx-ta", "hi");
  await logHas(page, "ta-input");
  await page.dispatchEvent("#fx-ta", "cut", { bubbles: true });
  await logHas(page, "ta-cut");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

// Link first on its page: a cold Link press after another component resumed is lost (pre-existing, also without DOM props).
test("dom-events forms: Link: global events chained with press, focus and key events", async () => {
  const { page, seen } = await open();
  await page.click("#fx-ln");
  await logHas(page, "ln-down");
  await logHas(page, "ln-press");
  await logHas(page, "ln-focus:true");
  await page.keyboard.press("b");
  await logHas(page, "ln-key:b");
  await page.dblclick("#fx-ln");
  await logHas(page, "ln-dbl");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("dom-events forms: Label / Text / FieldError / Form / Group (chained hover)", async () => {
  const { page, seen } = await open();
  await page.click(L("lb"));
  await logHas(page, "lb-click");
  await page.dblclick(L("tx"));
  await logHas(page, "tx-dbl");
  await page.click(L("fe"));
  await logHas(page, "fe-click");
  await page.hover(L("fm"));
  await logHas(page, "fm-enter");
  await page.hover(L("gr"));
  await logHas(page, "gr-hover");
  await logHas(page, "gr-enter");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("dom-events forms: Breadcrumbs (+ items), Toolbar, Disclosure", async () => {
  const { page, seen } = await open();
  await page.dispatchEvent(L("bc"), "wheel", { bubbles: true });
  await logHas(page, "bc-wheel");
  await page.dispatchEvent(L("bci"), "dblclick", { bubbles: true });
  await logHas(page, "bci-dbl");
  await page.dblclick(L("tl"));
  await logHas(page, "tl-dbl");
  await page.dblclick(L("ds") + " summary");
  await logHas(page, "ds-dbl");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
