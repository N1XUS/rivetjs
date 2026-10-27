// Section C props / variants on a resumed page (`/section-c`; UI-PORT S7, Rivet additions with feature sets inspired by
// HeroUI Pro's public docs): a custom TrendChip indicator hides the default icon (CSS), structured EmptyState is a
// centred column while a plain one keeps the compact look, Rating with a heart icon and a render function follows a cold
// pick, Kpi progress fills by `--kpi-progress` and the actions slot sits in the corner.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("section C: trend chip, empty state, rating, kpi", async () => {
  const page = await s.browser.newPage({ viewport: { width: 900, height: 900 } });
  await page.goto(s.origin + "/section-c");
  await page.waitForLoadState("networkidle");
  const display = (sel: string) => page.evaluate((q) => getComputedStyle(document.querySelector(q)!).display, sel);
  assert.equal(await display("#tc-default .trend-chip__icon"), "block");
  assert.equal(await display("#tc-custom .trend-chip__icon"), "none");
  assert.equal(await display("#tc-custom .trend-chip__indicator"), "flex"); // blockified flex item
  assert.equal(await display("#es"), "flex");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#es")!).borderStyle), "dashed");
  assert.equal(await display("#es-plain"), "block");
  assert.equal(await page.textContent("#es-plain"), "No results found");
  assert.equal(await page.locator("#rt-heart .rating__item svg").count(), 10);
  assert.equal(await page.locator("#rt-render [data-on]").count(), 2);
  await page.click("#rt-render .rating__item:nth-child(4)");
  await page.waitForFunction(() => document.querySelector("#rt-score")?.textContent === "4");
  await page.waitForFunction(() => document.querySelectorAll("#rt-render [data-on]").length === 4);
  const bar = await page.evaluate(() => {
    const track = document.querySelector("#kpi .kpi__progress")!.getBoundingClientRect();
    const fill = document.querySelector("#kpi .kpi__progress-bar")!.getBoundingClientRect();
    return Math.round((fill.width / track.width) * 100);
  });
  assert.equal(bar, 64);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#kpi .kpi__actions")!).position), "absolute");
  await page.close();
});
