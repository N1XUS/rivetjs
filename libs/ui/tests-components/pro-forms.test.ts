// Pro-forms lane — resumed story app (`/pro-forms`; Rivet additions, feature sets inspired by HeroUI Pro's public docs):
// SSR markup + CSS, nothing boots at load, and the browser-only behaviour per component (keyboard,
// focus-visible, pointer, animated indicator).
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

const waitText = (page: Page, sel: string, value: string) =>
  page.waitForFunction(([q, v]) => document.querySelector(q!)?.textContent === v, [sel, value] as const);
const waitAttr = (page: Page, sel: string, name: string, value: string | null) =>
  page.waitForFunction(([q, n, v]) => document.querySelector(q!)?.getAttribute(n!) === v, [sel, name, value] as const);

test("pro-forms: SSR markup + CSS, nothing boots at load", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/pro-forms");
    assert.equal(await page.getAttribute("#seg", "role"), "radiogroup");
    assert.equal(await page.getAttribute("#seg", "class"), "segment segment--md segment--default");
    assert.equal(await page.getAttribute("#seg [role=radio]:nth-of-type(2)", "aria-checked"), "true");
    // Roving tab stop in the server HTML (as the resumed toolbar): only the selected item is in the tab order.
    assert.deepEqual(await page.$$eval("#seg [role=radio]", (els) => els.map((el) => el.getAttribute("tabindex"))), ["-1", null, "-1", "-1"]);
    assert.notEqual(await page.$eval("#seg", (el) => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
    // Separator next to the selected item is hidden.
    assert.equal(await page.$eval("#seg [data-slot=segment-separator]", (el) => getComputedStyle(el).opacity), "0");
    assert.equal(await page.$eval("#ns select", (el) => (el as HTMLSelectElement).value), "de");
    assert.equal(await page.$eval("#ns select", (el) => getComputedStyle(el).appearance), "none");
    assert.equal(await page.locator("#ns [data-slot=native-select-default-indicator]").count(), 1);
    assert.equal(await page.getAttribute("#rbg [data-slot=radio-button-group]", "role"), "radiogroup");
    assert.equal(await page.getAttribute("#rbg [data-slot=radio-button-group-item]:has(input[value=team])", "data-selected"), "true");
    assert.equal(await page.$eval("#rbg input[value=team]", (el) => (el as HTMLInputElement).checked), true);
    assert.equal(await page.$eval("#cbg input[value=backup]", (el) => (el as HTMLInputElement).checked), true);
    assert.equal(await page.$$eval("#nst [data-slot=number-stepper-char]", (els) => els.map((e) => e.textContent).join("")), "9");
    assert.equal(await page.locator("#nst [data-roll]").count(), 0);
    assert.equal(await page.$eval("#nst input", (el) => getComputedStyle(el).color), "rgba(0, 0, 0, 0)");
    assert.equal(await page.textContent("#csl output"), "40");
    assert.match((await page.getAttribute("#csl [data-slot=cell-slider-fill]", "style")) ?? "", /width: ?40%/);
    assert.equal(await page.textContent("#csel .cell-select__value"), "System");
    assert.equal(await page.textContent("#csel .cell-select__label"), "Theme");
    assert.notEqual(await page.$eval("#csel .cell-select__trigger", (el) => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
    assert.equal(await page.textContent("#isel .inline-select__value"), "Website");
    assert.equal(await page.locator("#isel [data-slot=breadcrumbs-item]:nth-child(2) [data-slot=breadcrumbs-separator]").count(), 1);
    assert.equal(await page.locator("#isel [data-slot=breadcrumbs-item]:nth-child(2) a").count(), 0);
    await page.waitForLoadState("networkidle");
    // Nothing boots at load: no component runs (chunks of hover / focus handlers may be prefetched while visible), and no
    // client effect is recorded (the cdk TextField slot ids resolve during server rendering), so the runtime never starts at idle.
    assert.equal(await page.locator("script[data-boot]").count(), 0, "no idle boot");
    assert.equal(
      await page.evaluate(() => (JSON.parse(document.querySelector('script[type="rivet/state"]')!.textContent!) as { fx?: unknown[] }).fx?.length ?? 0),
      0,
    );
    assert.equal(await page.evaluate(() => (window as { __componentRuns?: unknown }).__componentRuns), undefined);
    assert.deepEqual(seen.errors, []);
  }));

test("segment: a cold Tab stops once, on the selected item", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/pro-forms");
    await page.waitForLoadState("networkidle");
    await page.focus("#before");
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "radio");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-checked")), "true");
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") !== "radio");
    assert.equal(await page.evaluate(() => !!document.activeElement?.closest("#seg")), false);
    assert.deepEqual(seen.errors, []);
  }));

test("segment: resumed click selects + indicator glides; arrow keys move focus, Space selects; disabled item skipped", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/pro-forms");
    const day = "#seg [role=radio]:nth-of-type(1)";
    await page.click(day);
    await waitText(page, "#seg-state", "day");
    await waitAttr(page, day, "aria-checked", "true");
    assert.equal(await page.locator("#seg [data-slot=segment-indicator]").count(), 1);
    assert.equal(await page.locator(`${day} [data-slot=segment-indicator]`).count(), 1);
    // Move through the indicator transition: the indicator element has a translate transition.
    const month = "#seg [role=radio]:nth-of-type(3)";
    await page.click(month);
    await waitText(page, "#seg-state", "month");
    const transition = await page.$eval(`${month} [data-slot=segment-indicator]`, (el) => getComputedStyle(el).transitionProperty);
    assert.match(transition, /translate/);
    // Keyboard: Tab into the group focuses the selected radio; arrows move focus (toolbar), Space selects.
    await page.focus("#before");
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "radio");
    await page.keyboard.press("ArrowLeft");
    await waitAttr(page, "#seg [role=radio]:nth-of-type(2)", "data-focus-visible", "true");
    await page.keyboard.press("Space");
    await waitText(page, "#seg-state", "week");
    assert.equal(await page.getAttribute("#seg [role=radio]:nth-of-type(4)", "disabled"), "");
    assert.deepEqual(seen.errors, []);
  }));

test("native-select: resumed pick updates the value signal; label focuses the select; keyboard focus-visible", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/pro-forms");
    await page.selectOption("#ns select", "jp");
    await waitText(page, "#ns-state", "jp");
    await page.click("#ns label");
    assert.equal(await page.evaluate(() => document.activeElement?.localName), "select");
    await page.locator("#ns select").blur();
    await page.focus("#before");
    // Tab past the segment (one tab stop; its resumed keydown handling may hold a press) to the select.
    for (let i = 0; i < 4 && (await page.evaluate(() => document.activeElement?.localName)) !== "select"; i++) await page.keyboard.press("Tab");
    await waitAttr(page, "#ns select", "data-focus-visible", "true");
    assert.deepEqual(seen.errors, []);
  }));

test("radio-button-group: resumed card click selects; arrow keys move the native selection; disabled card skipped", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/pro-forms");
    const card = (v: string) => `#rbg [data-slot=radio-button-group-item]:has(input[value=${v}])`;
    await page.click(card("solo"));
    await waitText(page, "#rbg-state", "solo");
    await waitAttr(page, card("solo"), "data-selected", "true");
    assert.equal(await page.getAttribute(card("team"), "data-selected"), null);
    // The selected card's border is the accent color.
    const border = await page.$eval(card("solo"), (el) => getComputedStyle(el).borderTopColor);
    assert.notEqual(border, await page.$eval(card("team"), (el) => getComputedStyle(el).borderTopColor));
    await page.keyboard.press("ArrowRight");
    await waitText(page, "#rbg-state", "team");
    await waitAttr(page, card("team"), "data-focus-visible", "true");
    await page.keyboard.press("ArrowRight"); // org is disabled: wraps to solo
    await waitText(page, "#rbg-state", "solo");
    assert.deepEqual(seen.errors, []);
  }));

test("checkbox-button-group: resumed clicks toggle cards; Space toggles the focused card", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/pro-forms");
    const card = (v: string) => `#cbg [data-slot=checkbox-button-group-item]:has(input[value=${v}])`;
    await page.click(card("sso"));
    await waitText(page, "#cbg-state", "backup,sso");
    await waitAttr(page, card("sso"), "data-selected", "true");
    await page.click(card("backup"));
    await waitText(page, "#cbg-state", "sso");
    await page.focus("#cbg input[value=backup]");
    await page.keyboard.press("Space");
    await waitText(page, "#cbg-state", "sso,backup");
    assert.deepEqual(seen.errors, []);
  }));

test("number-stepper: resumed increment rolls the changed digit; bound disables; typing + Enter commits; ArrowUp steps", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/pro-forms");
    const display = () => page.$$eval("#nst [data-slot=number-stepper-char]", (els) => els.map((e) => e.textContent).join(""));
    await page.click("#nst [data-slot=number-stepper-increment-button]");
    await waitText(page, "#nst-state", "10");
    assert.equal(await display(), "10");
    assert.ok((await page.locator("#nst [data-roll]").count()) > 0, "client-created characters roll in");
    assert.equal(await page.getAttribute("#nst [data-slot=number-stepper-increment-button]", "disabled"), "");
    await page.click("#nst [data-slot=number-stepper-decrement-button]");
    await waitText(page, "#nst-state", "9");
    // Typing: the focused input shows its own text (display hidden), Enter commits.
    await page.fill("#nst input", "3");
    assert.notEqual(await page.$eval("#nst input", (el) => getComputedStyle(el).color), "rgba(0, 0, 0, 0)");
    await page.keyboard.press("Enter");
    await waitText(page, "#nst-state", "3");
    await page.keyboard.press("ArrowUp");
    await waitText(page, "#nst-state", "4");
    await page.focus("#before");
    await page.waitForFunction(() => Array.from(document.querySelectorAll("#nst [data-slot=number-stepper-char]"), (e) => e.textContent).join("") === "4");
    assert.deepEqual(seen.errors, []);
  }));

test("cell-slider: resumed press on the cell (also over the label) moves the value; arrow keys step", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/pro-forms");
    await page.locator("#csl").scrollIntoViewIfNeeded();
    const box = (await page.locator("#csl [data-slot=cell-slider]").boundingBox())!;
    // Press at 80% of the width (the output sits there, pointer-events none).
    await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2);
    await waitText(page, "#csl-state", "80");
    // Press over the label (left part): the track below takes it.
    const label = (await page.locator("#csl [data-slot=cell-slider-label]").boundingBox())!;
    await page.mouse.click(label.x + 2, label.y + label.height / 2);
    await page.waitForFunction(() => Number(document.querySelector("#csl-state")?.textContent) <= 20);
    await page.focus("#csl input[type=range]");
    const before = Number(await page.textContent("#csl-state"));
    await page.keyboard.press("ArrowRight");
    await waitText(page, "#csl-state", String(before + 10));
    await waitAttr(page, "#csl [data-slot=cell-slider-thumb]", "data-focus-visible", "true");
    assert.deepEqual(seen.errors, []);
  }));

test("cell-select: resumed press opens a bottom-end popover, option press updates the value; keyboard Enter / arrows", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/pro-forms");
    const trigger = "#csel [data-slot=cell-select-trigger]";
    await page.locator(trigger).scrollIntoViewIfNeeded();
    await page.click(trigger);
    await page.waitForSelector("[data-slot=cell-select-popover] [role=listbox]");
    await page.waitForTimeout(300);
    const t = (await page.locator(trigger).boundingBox())!;
    const pop = (await page.locator("[data-slot=cell-select-popover]").boundingBox())!;
    assert.ok(Math.abs(pop.x + pop.width - (t.x + t.width)) <= 2, `popover end-aligned (${pop.x + pop.width} vs ${t.x + t.width})`);
    assert.ok(pop.y >= t.y + t.height - 1, "below the trigger");
    await page.click("[data-slot=cell-select-popover] [role=option]:has-text('Dark')");
    await waitText(page, "#csel-state", "dark");
    await waitText(page, "#csel .cell-select__value", "Dark");
    await page.waitForSelector("[data-slot=cell-select-popover]", { state: "detached" });
    // Keyboard: focus-visible ring, Enter opens on the selected option, ArrowUp + Enter picks the previous one.
    await page.focus("#before");
    await page.locator(trigger).focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector("[data-slot=cell-select-popover] [role=listbox]");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await waitText(page, "#csel-state", "light");
    assert.deepEqual(seen.errors, []);
  }));

test("inline-select: breadcrumb switcher keeps the font, resumed pick updates the value", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/pro-forms");
    const trigger = "#isel [data-slot=inline-select-trigger]";
    const font = await page.$eval(trigger, (el) => getComputedStyle(el).fontSize);
    assert.equal(font, await page.$eval("#isel [data-slot=breadcrumbs-item] a", (el) => getComputedStyle(el).fontSize));
    assert.equal(await page.$eval(trigger, (el) => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
    await page.locator(trigger).scrollIntoViewIfNeeded();
    await page.click(trigger);
    await page.waitForSelector("[data-slot=inline-select-popover] [role=listbox]");
    assert.equal(await page.getAttribute(trigger, "aria-expanded"), "true");
    await page.click("[data-slot=inline-select-popover] [role=option]:has-text('Mobile app')");
    await waitText(page, "#isel-state", "app");
    await waitText(page, "#isel .inline-select__value", "Mobile app");
    assert.deepEqual(seen.errors, []);
  }));

test("button groups shorthand (T21): items cards select on a resumed page; item descriptions are named by the inputs", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/pro-forms");
    assert.equal(await page.locator("#sh-rbg [data-slot=radio-button-group-item]").count(), 2);
    const by = (await page.locator("#sh-rbg input").nth(0).getAttribute("aria-describedby"))!;
    assert.match(by, /\S/);
    assert.equal((await page.locator(`[id="${by.split(" ")[0]}"]`).textContent())?.trim(), "Up to 5 people");
    await page.click("#sh-rbg [data-slot=radio-button-group-item]:has(input[value=l])");
    await waitText(page, "#sh-rbg-state", "l");
    await page.click("#sh-cbg [data-slot=checkbox-button-group-item]:has(input[value=sms])");
    await waitText(page, "#sh-cbg-state", "sms");
    assert.deepEqual(seen.errors, []);
  }));

test("shorthand (T22): resumed CellSelect label + Items, InlineSelect items, CellSlider label", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/pro-forms");
    const trigger = "#sh-csel [data-slot=cell-select-trigger]";
    assert.equal(await page.$eval(`${trigger} .cell-select__label`, (el) => el.textContent), "Density");
    await page.locator(trigger).scrollIntoViewIfNeeded();
    await page.click(trigger);
    await page.waitForSelector("[data-slot=cell-select-popover] [role=option]");
    await page.click("[data-slot=cell-select-popover] [role=option]:has-text('Comfortable')");
    await waitText(page, "#sh-csel-state", "comfortable");
    await waitText(page, "#sh-csel .cell-select__value", "Comfortable");
    await page.click("#sh-isel [data-slot=inline-select-trigger]");
    await page.waitForSelector("[data-slot=inline-select-popover] [role=option]");
    await page.click("[data-slot=inline-select-popover] [role=option]:has-text('day')");
    await waitText(page, "#sh-isel-state", "day");
    const input = "#sh-csl input[type=range]";
    assert.equal(await page.$eval("#sh-csl [data-slot=cell-slider-label]", (el) => el.textContent), "Opacity");
    await page.focus(input);
    await page.keyboard.press("ArrowRight");
    await waitText(page, "#sh-csl-state", "60");
    await waitText(page, "#sh-csl output", "60");
    assert.deepEqual(seen.errors, []);
  }));
