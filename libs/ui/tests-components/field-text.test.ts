// Field text size (styles/TWEAKS.md TW-195, `field-text` utility) on `/field-text` (`app/src/routes/field-text.tsx`): on a
// coarse pointer (Playwright `hasTouch` → `(pointer: coarse)`) every editable control renders its text at ≥ 16 px (iOS
// Safari zooms the page into a focused field with smaller text); a fine pointer at desktop width keeps the design sizes.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

/** Desktop text size per control (fine pointer, 1280 px): 14 px fields, 15 px PromptInput md. */
const DESKTOP: Record<string, number> = {
  input: 14,
  textarea: 14,
  "input-group": 14,
  "search-field": 14,
  "number-field": 14,
  "number-stepper": 14,
  "native-select": 14,
  "date-field": 14,
  "color-field": 14,
  "combo-box": 14,
  "prompt-input": 15,
  "prompt-input-tokens": 15,
};

async function sizes(touch: boolean, width: number): Promise<Record<string, number>> {
  const page: Page = await s.browser.newPage({ viewport: { width, height: 900 }, hasTouch: touch, isMobile: touch });
  try {
    await page.goto(s.origin + "/field-text", { waitUntil: "networkidle" });
    assert.equal(await page.evaluate(() => matchMedia("(pointer: coarse)").matches), touch);
    return await page.evaluate(() => {
      const editable = 'input:not([type=hidden]):not([aria-hidden="true"]), textarea, select, [role="spinbutton"][contenteditable]';
      const out: Record<string, number> = {};
      for (const el of document.querySelectorAll<HTMLElement>("[data-field]")) out[el.dataset.field!] = parseFloat(getComputedStyle(el).fontSize);
      for (const scope of document.querySelectorAll<HTMLElement>("[data-field-scope]")) {
        const el = scope.querySelector<HTMLElement>(editable);
        out[scope.dataset.fieldScope!] = el ? parseFloat(getComputedStyle(el).fontSize) : NaN;
      }
      return out;
    });
  } finally {
    await page.close();
  }
}

test("field text: ≥ 16 px on a coarse pointer (no iOS focus zoom), at phone and tablet widths", async () => {
  for (const width of [390, 1024]) {
    const m = await sizes(true, width);
    assert.deepEqual(Object.keys(m).sort(), Object.keys(DESKTOP).sort());
    for (const [name, size] of Object.entries(m)) assert.ok(size >= 16, `${name} @${width}: ${size}px`);
  }
});

test("field text: desktop sizes unchanged on a fine pointer", async () => {
  const m = await sizes(false, 1280);
  assert.deepEqual(m, DESKTOP);
});
