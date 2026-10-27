// CellColorPicker on a resumed page (`/cell-color-picker`; Rivet addition, feature set inspired by HeroUI Pro's public Cell
// Color Picker docs): server hex value, a cold press opens the popover, a preset swatch sets the color (value display +
// two-way signal), the disabled cell does not open.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("cell color picker: cold open, preset, disabled", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 900 } });
  await page.goto(s.origin + "/cell-color-picker");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator("#ccp-value").textContent(), "#EF4444");
  await page.click("#ccp");
  await page.waitForSelector("#ccp-popover");
  await page.locator("#ccp-popover [role=option]").nth(2).click();
  await page.waitForFunction(() => document.querySelector("#ccp-value")?.textContent === "#3B82F6");
  await page.waitForFunction(() => document.querySelector("#ccp-signal")?.textContent === "rgba(59, 130, 246, 1)");
  await page.keyboard.press("Escape");
  await page.waitForSelector("#ccp-popover", { state: "detached" });
  assert.equal(await page.locator("#ccp-off").isDisabled(), true);
  await page.close();
});
