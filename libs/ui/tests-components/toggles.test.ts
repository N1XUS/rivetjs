// Toggle components — resumed story app (`/toggles`): the upstream checkbox / checkbox-group / radio / switch cases that need a
// real browser: Tab focus + focus-visible on the Content label, Space toggles, arrow keys select radios, hover state (not when
// disabled), clicks on the label toggle the two-way signals; the switch thumb eases into the selected state (same node).
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

const attr = (sel: string, name: string, value: string | null) => [sel, name, value] as const;
const waitAttr = (page: Page, [sel, name, value]: readonly [string, string, string | null]) =>
  page.waitForFunction(([s, n, v]) => document.querySelector(s!)?.getAttribute(n!) === v, [sel, name, value] as const);
const waitText = (page: Page, sel: string, value: string) =>
  page.waitForFunction(([s, v]) => document.querySelector(s!)?.textContent === v, [sel, value] as const);

test("toggles: SSR markup = HeroUI classes + data-slots", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/toggles");
    assert.equal(await page.getAttribute("[data-testid=cb]", "data-slot"), "checkbox");
    assert.equal(await page.getAttribute("#cb-input", "type"), "checkbox");
    assert.equal(await page.getAttribute("[data-testid=cbg]", "role"), "group");
    assert.equal(await page.getAttribute("[data-testid=rg]", "role"), "radiogroup");
    assert.equal(await page.getAttribute("#sw-input", "role"), "switch");
    assert.match((await page.getAttribute("[data-testid=sw]", "class"))!, /\bswitch\b/);
    await page.waitForLoadState("networkidle");
    assert.deepEqual(seen.errors, []);
  }));

test("checkbox (upstream): Space toggles after Tab; focus-visible on the content; label click toggles", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/toggles");
    await page.focus("#before");
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => document.activeElement?.id === "cb-input");
    await waitAttr(page, attr("[data-testid=cb] [data-slot=checkbox-content]", "data-focus-visible", "true"));
    await page.keyboard.press(" ");
    await waitText(page, "#cb-state", "on");
    await waitAttr(page, attr("[data-testid=cb]", "data-selected", "true"));
    await page.click("[data-testid=cb] [data-slot=checkbox-content]");
    await waitText(page, "#cb-state", "off");
    assert.deepEqual(seen.errors, []);
  }));

test("checkbox-group (upstream): mouse + keyboard toggles update the value array", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/toggles");
    await page.click("label:has(#cbg-coding)");
    await waitText(page, "#cbg-state", "coding");
    await page.focus("#cbg-design");
    await page.keyboard.press(" ");
    await waitText(page, "#cbg-state", "coding,design");
    assert.deepEqual(seen.errors, []);
  }));

test("radio (upstream): arrow keys select; click selects", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/toggles");
    await page.focus("#rg-a");
    await page.keyboard.press("ArrowDown");
    await waitText(page, "#rg-state", "b");
    await page.waitForFunction(() => document.activeElement?.id === "rg-b");
    await page.keyboard.press("ArrowUp");
    await waitText(page, "#rg-state", "a");
    await page.click("label:has(#rg-b)");
    await waitText(page, "#rg-state", "b");
    assert.deepEqual(seen.errors, []);
  }));

test("switch (upstream): Space toggles; hover on the content; no hover when disabled", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/toggles");
    await page.focus("#sw-input");
    await page.keyboard.press(" ");
    await waitText(page, "#sw-state", "on");
    await waitAttr(page, attr("[data-testid=sw]", "data-selected", "true"));
    const content = "[data-testid=sw] [data-slot=switch-content]";
    await page.hover(content);
    await waitAttr(page, attr(content, "data-hovered", "true"));
    await page.mouse.move(0, 0);
    await waitAttr(page, attr(content, "data-hovered", null));
    // A disabled label never settles for Playwright's actionability check (`hover`): move the mouse onto its box instead.
    const box = (await page.locator("[data-testid=sw-off] [data-slot=switch-content]").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(100);
    assert.equal(await page.getAttribute("[data-testid=sw-off] [data-slot=switch-content]", "data-hovered"), null);
    assert.equal(await page.getAttribute("#sw-off-input", "disabled"), "");
    assert.deepEqual(seen.errors, []);
  }));

test("switch: the thumb eases into the selected state (margin + shadow transitions on the same node)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/toggles");
    await page.waitForLoadState("networkidle");
    const thumb = "[data-testid=sw] [data-slot=switch-thumb]";
    const props = await page.locator(thumb).evaluate((el) => getComputedStyle(el).transitionProperty);
    for (const p of ["margin", "background-color", "box-shadow"]) assert.match(props, new RegExp(`\\b${p}\\b`), props);
    await page.locator(thumb).evaluate((el) => ((el as HTMLElement & { mark?: number }).mark = 1));
    await page.click("[data-testid=sw] [data-slot=switch-content]");
    await page.waitForFunction(
      (s) =>
        document
          .getAnimations()
          .some(
            (a) => a instanceof CSSTransition && a.transitionProperty === "box-shadow" && (a.effect as KeyframeEffect).target === document.querySelector(s),
          ),
      thumb,
    );
    assert.equal(await page.locator(thumb).evaluate((el) => (el as HTMLElement & { mark?: number }).mark), 1);
    assert.deepEqual(seen.errors, []);
  }));

test("shorthand (T21): label / description / items forms render the compound markup and toggle on a resumed page", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/toggles");
    // Same parts as the compound form; descriptions are named by the inputs (no IDREF to a missing part).
    for (const slot of ["checkbox-content", "checkbox-control", "checkbox-indicator"])
      assert.equal(await page.locator(`[data-testid=sh-cb] [data-slot=${slot}]`).count(), 1, slot);
    const described = (await page.getAttribute("#sh-cb-input", "aria-describedby"))!;
    assert.equal(await page.locator(`[id="${described}"]`).textContent(), "Once a month");
    assert.equal(await page.locator("[data-testid=sh-cbg] [data-slot=checkbox]").count(), 3);
    assert.equal(await page.locator("[data-testid=sh-rg] [data-slot=radio]").count(), 2);
    for (const [group, label] of [
      ["sh-cbg", "Topics"],
      ["sh-rg", "Tier"],
    ] as const) {
      const by = (await page.getAttribute(`[data-testid=${group}]`, "aria-labelledby"))!;
      assert.equal(await page.locator(`[id="${by}"]`).textContent(), label);
    }
    await page.click("[data-testid=sh-cb] [data-slot=checkbox-content]");
    await waitText(page, "#sh-cb-state", "on");
    await page.click("[data-testid=sh-cbg] [data-slot=checkbox]:nth-of-type(2) [data-slot=checkbox-content]");
    await waitText(page, "#sh-cbg-state", "wasm");
    assert.equal(await page.locator("[data-testid=sh-cbg] input[value=ssr]").isDisabled(), true);
    await page.click("[data-testid=sh-rg] [data-slot=radio]:nth-of-type(2) [data-slot=radio-content]");
    await waitText(page, "#sh-rg-state", "pro");
    await page.keyboard.press("ArrowUp");
    await waitText(page, "#sh-rg-state", "free");
    await page.click("[data-testid=sh-sw] [data-slot=switch-content]");
    await waitText(page, "#sh-sw-state", "on");
    assert.deepEqual(seen.errors, []);
  }));
