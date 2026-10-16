// ToggleButton / ButtonGroup / ToggleButtonGroup — resumed story app (`/toggle-buttons`): SSR markup, live group `isDisabled` /
// `size` after resume (every Button updates; nodes kept from the second change, P3), two-way `isSelected`, upstream interaction
// cases (hover, press, focus-visible, Enter / Space, disabled blocks + no hover), group selectionMode multiple / single.
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

/** Tags the element (an expando on the node): `marked` later tells whether it is still the same node. */
const mark = (page: Page, selector: string) => page.$eval(selector, (el) => void ((el as unknown as Record<string, boolean>).__rvMark = true));
const marked = (page: Page, selector: string) => page.$eval(selector, (el) => (el as unknown as Record<string, boolean>).__rvMark === true);
const attr = (page: Page, selector: string, name: string) => page.getAttribute(selector, name);
const waitAttr = (page: Page, selector: string, name: string, value: string | null) =>
  page.waitForFunction(([sel, n, v]) => document.querySelector(sel!)?.getAttribute(n!) === v, [selector, name, value] as const);
const BUTTONS = ["#bg-a", "#bg-b", "#bg-c"];

test("toggle-buttons: SSR markup — group classes + inherited props, separators, toggle ARIA, CSS applied", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/toggle-buttons");
    assert.equal(await attr(page, "#bg", "role"), "group");
    assert.equal(await attr(page, "#bg", "data-slot"), "button-group");
    assert.equal(await attr(page, "#bg", "class"), "button-group button-group--horizontal");
    for (const b of BUTTONS) {
      assert.match((await attr(page, b, "class")) ?? "", /button--sm/);
      assert.match((await attr(page, b, "class")) ?? "", /button--secondary/);
    }
    assert.equal(await attr(page, "#bg [data-slot=button-group-separator]", "aria-hidden"), "true");
    assert.equal(await attr(page, "#t-bold", "data-slot"), "toggle-button");
    assert.equal(await attr(page, "#t-bold", "aria-pressed"), "false");
    assert.equal(await attr(page, "#tg-multi", "role"), "toolbar");
    assert.equal(await attr(page, "#tg-multi", "data-slot"), "toggle-button-group");
    assert.match((await page.$eval("#tg-multi button", (el) => el.className)) ?? "", /toggle-button--lg/);
    assert.equal(await attr(page, "#tg-multi [data-slot=toggle-button-group-separator]", "class"), "toggle-button-group__separator");
    assert.equal(await attr(page, "#tg-single", "role"), "radiogroup");
    assert.equal(await page.$eval("#tg-single [role=radio]", (el) => el.getAttribute("aria-checked")), "true");
    assert.notEqual(await page.$eval("#t-bold", (el) => getComputedStyle(el).paddingLeft), "0px");
    await page.waitForLoadState("networkidle");
    assert.deepEqual(seen.errors, []);
  }));

test("button-group: group-level isDisabled change after resume updates every Button (nodes kept from the second change)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/toggle-buttons");
    for (const b of BUTTONS) assert.equal(await attr(page, b, "disabled"), null);
    await page.click("#bg-toggle");
    await waitAttr(page, "#bg-c", "data-disabled", "true");
    for (const b of BUTTONS) {
      assert.notEqual(await attr(page, b, "disabled"), null, `${b} disabled after the first change`);
      await mark(page, b);
    }
    await mark(page, "#bg");
    assert.equal(await attr(page, "#bg", "data-disabled"), "true");
    for (const round of [2, 3, 4]) {
      await page.click("#bg-toggle");
      const want = round % 2 === 1 ? "true" : null;
      await waitAttr(page, "#bg-a", "data-disabled", want);
      for (const b of BUTTONS) {
        assert.equal((await attr(page, b, "disabled")) !== null, want === "true", `${b} round ${round}`);
        assert.ok(await marked(page, b), `${b} kept (round ${round})`);
      }
      assert.ok(await marked(page, "#bg"), "group kept");
    }
    await page.click("#bg-size");
    await page.waitForFunction(() => /button--lg/.test(document.querySelector("#bg-b")?.className ?? ""));
    for (const b of BUTTONS) {
      assert.match((await attr(page, b, "class")) ?? "", /button--lg/);
      assert.ok(await marked(page, b), `${b} kept after the size change`);
    }
    assert.deepEqual(seen.errors, []);
  }));

test("toggle-button: isSelected signal both ways after resume (external set → aria, press → signal)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/toggle-buttons");
    await page.click("#t-bold-ext");
    await waitAttr(page, "#t-bold", "aria-pressed", "true");
    assert.equal(await page.textContent("#t-bold-state"), "on");
    assert.equal(await attr(page, "#t-bold", "data-selected"), "true");
    await mark(page, "#t-bold");
    await page.click("#t-bold");
    await waitAttr(page, "#t-bold", "aria-pressed", "false");
    await page.waitForFunction(() => document.querySelector("#t-bold-state")?.textContent === "off");
    await page.click("#t-bold");
    await waitAttr(page, "#t-bold", "aria-pressed", "true");
    assert.equal(await page.textContent("#t-bold-state"), "on");
    assert.ok(await marked(page, "#t-bold"), "toggle button kept");
    assert.deepEqual(seen.errors, []);
  }));

test("toggle-button: hover, press state, focus-visible, Enter / Space toggle; disabled blocks toggling and hover", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/toggle-buttons");
    await page.waitForLoadState("networkidle");
    await page.hover("#t-plain");
    await waitAttr(page, "#t-plain", "data-hovered", "true");
    await page.mouse.move(0, 0);
    await waitAttr(page, "#t-plain", "data-hovered", null);
    const box = (await page.locator("#t-plain").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await waitAttr(page, "#t-plain", "data-pressed", "true");
    await page.mouse.up();
    await waitAttr(page, "#t-plain", "data-pressed", null);
    await page.waitForFunction(() => document.querySelector("#t-plain-state")?.textContent === "true");
    await page.focus("#t-bold-ext");
    await page.keyboard.press("Tab");
    await waitAttr(page, "#t-plain", "data-focus-visible", "true");
    await page.keyboard.press("Enter");
    await waitAttr(page, "#t-plain", "aria-pressed", "false");
    await page.keyboard.press(" ");
    await waitAttr(page, "#t-plain", "aria-pressed", "true");
    assert.equal(await page.textContent("#t-plain-state"), "true");
    assert.notEqual(await attr(page, "#t-dis", "disabled"), null);
    assert.equal(await attr(page, "#t-dis", "data-disabled"), "true");
    await page.hover("#t-dis", { force: true });
    await page.click("#t-dis", { force: true });
    await page.waitForTimeout(50);
    assert.equal(await attr(page, "#t-dis", "data-hovered"), null);
    assert.equal(await attr(page, "#t-dis", "aria-pressed"), "false");
    assert.deepEqual(seen.errors, []);
  }));

test("toggle-button-group: selectionMode multiple (aria-pressed, Sets) and single (radio, disallowEmptySelection) after resume", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/toggle-buttons");
    const bold = "#tg-multi button:nth-of-type(1)";
    const italic = "#tg-multi button:nth-of-type(2)";
    await page.click(bold);
    await waitAttr(page, bold, "aria-pressed", "true");
    await page.waitForFunction(() => document.querySelector("#tg-multi-keys")?.textContent === "bold");
    await page.click(italic);
    await page.waitForFunction(() => document.querySelector("#tg-multi-keys")?.textContent === "bold,italic");
    assert.equal(await attr(page, italic, "aria-pressed"), "true");
    const left = "#tg-single [role=radio]:nth-of-type(1)";
    const center = "#tg-single [role=radio]:nth-of-type(2)";
    await page.click(left);
    await page.waitForTimeout(50);
    assert.equal(await attr(page, left, "aria-checked"), "true", "disallowEmptySelection keeps the selection");
    await page.click(center);
    await waitAttr(page, center, "aria-checked", "true");
    assert.equal(await attr(page, left, "aria-checked"), "false");
    assert.equal(await page.textContent("#tg-single-keys"), "center");
    assert.deepEqual(seen.errors, []);
  }));

test("toggle-button-group: live isDisabled / orientation after resume reach the group + every ToggleButton (nodes kept from the second change)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/toggle-buttons");
    const x = "#tg-live button:nth-of-type(1)";
    const y = "#tg-live button:nth-of-type(2)";
    assert.equal(await attr(page, "#tg-live", "data-disabled"), null);
    await page.click("#tg-live-dis");
    await waitAttr(page, "#tg-live", "data-disabled", "true");
    assert.equal(await attr(page, "#tg-live", "aria-disabled"), "true");
    for (const b of [x, y]) assert.notEqual(await attr(page, b, "disabled"), null, `${b} disabled after the first change`);
    await mark(page, "#tg-live");
    await mark(page, x);
    for (const round of [2, 3, 4]) {
      await page.click("#tg-live-dis");
      const want = round % 2 === 1 ? "true" : null;
      await waitAttr(page, "#tg-live", "data-disabled", want);
      assert.equal(await attr(page, "#tg-live", "aria-disabled"), want, `aria-disabled round ${round}`);
      for (const b of [x, y]) {
        assert.equal((await attr(page, b, "disabled")) !== null, want === "true", `${b} round ${round}`);
        assert.equal(await attr(page, b, "data-disabled"), want, `${b} data-disabled round ${round}`);
      }
      assert.ok(await marked(page, "#tg-live"), `group kept (round ${round})`);
      assert.ok(await marked(page, x), `button kept (round ${round})`);
    }
    // Enabled again (round 4): presses select.
    await page.click(y);
    await page.waitForFunction(() => document.querySelector("#tg-live-keys")?.textContent === "y");
    assert.equal(await attr(page, y, "aria-pressed"), "true");
    await page.click("#tg-live-orient");
    await waitAttr(page, "#tg-live", "data-orientation", "vertical");
    assert.equal(await attr(page, "#tg-live", "aria-orientation"), "vertical");
    assert.equal(await attr(page, "#tg-live", "data-rk"), "ArrowUp ArrowDown");
    assert.match((await attr(page, "#tg-live", "class")) ?? "", /toggle-button-group--vertical/);
    await page.focus(x);
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction((sel) => document.activeElement === document.querySelector(sel), y);
    assert.ok(await marked(page, "#tg-live"), "group kept after the orientation change");
    assert.deepEqual(seen.errors, []);
  }));
