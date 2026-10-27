// ListView on a resumed page (`/list-view`; Rivet addition, feature set inspired by HeroUI Pro's public List View docs): a
// cold row press selects (checkbox checked, count updates), the disabled row ignores presses, keyboard Down + Space selects
// the next row; a plain list fires onAction on press; the virtualized list renders the server window, a cold wheel scroll renders the rows in view.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("list view: cold selection, disabled row, keyboard, onAction", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 900 } });
  await page.goto(s.origin + "/list-view");
  await page.waitForLoadState("networkidle");
  const row = (id: string, key: string) => page.locator(`#${id} [role=row][data-key="${key}"]`);
  await row("lv-select", "ada").click();
  await page.waitForFunction(() => document.querySelector("#lv-count")?.textContent === "1 selected");
  assert.equal(await row("lv-select", "ada").getAttribute("data-selected"), "true");
  assert.equal(await page.locator('#lv-select [role=row][data-key="ada"] input[type=checkbox]').isChecked(), true);
  await row("lv-select", "grace").click({ force: true });
  await page.waitForTimeout(100);
  assert.equal(await page.locator("#lv-count").textContent(), "1 selected");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await page.waitForFunction(() => document.querySelector("#lv-count")?.textContent === "2 selected");
  await row("lv-action", "notes").click();
  await page.waitForFunction(() => document.querySelector("#lv-last")?.textContent === "notes");
  // Virtualized: the server window only; a cold scroll renders the rows in view.
  const keys = () => page.evaluate(() => [...document.querySelectorAll("#lv-virtual [role=row]")].map((e) => Number(e.getAttribute("data-key"))));
  const first = await keys();
  assert.ok(first.includes(0) && !first.includes(1999), String(first));
  await page.locator("#lv-virtual").hover();
  await page.mouse.wheel(0, 2200);
  await page.waitForFunction(() => document.querySelector('#lv-virtual [role=row][data-key="52"]') !== null);
  assert.ok(!(await keys()).includes(0));
  await page.close();
});
