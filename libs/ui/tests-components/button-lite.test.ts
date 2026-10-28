// PRESS-LITE (`libs/compiler/native-lite.ts`, ui `button-lite.tsx`): proven `onPress` Button sites on a resumed page are
// native `<button>`s with a plain click listener. Cold first click (mouse, keyboard Enter / Space, touch tap), live
// `isDisabled` → native `disabled`, the focus ring from `:focus-visible` CSS, no `data-pressed` while held, and no cdk
// press / focus-visible code fetched.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>, options: { hasTouch?: boolean } = {}): Promise<void> {
  const context = await s.browser.newContext(options);
  const page = await context.newPage();
  try {
    await body(page);
  } finally {
    await context.close();
  }
}

const count = (page: Page, n: number) => page.waitForFunction((v) => document.querySelector("#bl-count")?.textContent === String(v), n);

test("button lite: native markup (same classes, live disabled), first mouse click runs onPress, no press machinery", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/button-lite");
    assert.match((await page.getAttribute("#bl-inc", "class")) ?? "", /^button button--md button--primary$/);
    assert.equal(await page.getAttribute("#bl-inc", "data-slot"), "button");
    assert.equal(await page.getAttribute("#bl-inc", "type"), "button");
    assert.equal(await page.$eval("#bl-reset", (el) => (el as HTMLButtonElement).disabled), true);
    assert.equal(await page.getAttribute("#bl-reset", "data-disabled"), "true");
    // Held: no `data-pressed` (the cdk path sets it on pointerdown); `:active` styles the press instead.
    await page.hover("#bl-inc");
    await page.mouse.down();
    assert.equal(await page.getAttribute("#bl-inc", "data-pressed"), null);
    assert.equal(await page.$eval("#bl-inc", (el) => el.matches(":active")), true);
    await page.mouse.up();
    await count(page, 1);
    await page.waitForFunction(() => !(document.querySelector("#bl-reset") as HTMLButtonElement).disabled);
    assert.equal(await page.getAttribute("#bl-reset", "data-disabled"), null);
    await page.click("#bl-reset");
    await count(page, 0);
    await page.waitForFunction(() => (document.querySelector("#bl-reset") as HTMLButtonElement).disabled);
    // A disabled native button ignores clicks.
    await page.click("#bl-reset", { force: true });
    await page.click("#bl-inc");
    await count(page, 1);
    await page.waitForLoadState("networkidle");
    assert.deepEqual(
      seen.scripts.filter((url) => /press|focus-visible|slots/.test(url)),
      [],
      "no cdk press / focus-visible / slots chunk",
    );
    assert.deepEqual(seen.errors, []);
  }));

test("button lite: cold keyboard — Enter and Space activate, the focus ring comes from :focus-visible", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/button-lite");
    await page.focus("#bl-inc");
    await page.keyboard.press("Enter");
    await count(page, 1);
    await page.keyboard.press("Space");
    await count(page, 2);
    // Keyboard focus: `:focus-visible` matches and `button.css` draws the ring without any `data-focus-visible`.
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    assert.equal(await page.$eval("#bl-inc", (el) => el.matches(":focus-visible")), true);
    assert.equal(await page.getAttribute("#bl-inc", "data-focus-visible"), null);
    const ring = await page.$eval("#bl-inc", (el) => {
      const style = getComputedStyle(el);
      return style.outlineStyle !== "none" || style.boxShadow !== "none";
    });
    assert.equal(ring, true, "focus ring drawn");
    assert.deepEqual(seen.errors, []);
  }));

test("button lite: cold touch tap", () =>
  onPage(
    async (page) => {
      const seen = watch(page);
      await page.goto(s.origin + "/button-lite");
      await page.tap("#bl-inc");
      await count(page, 1);
      await page.tap("#bl-reset");
      await count(page, 0);
      assert.deepEqual(seen.errors, []);
    },
    { hasTouch: true },
  ));
