// Line gaps / dots / dashed and horizontal bars on a resumed page (`/charts-c`; UI-PORT-C, Rivet additions with feature sets
// inspired by HeroUI Pro's public area / bar / line chart docs): nothing boots and no chart script loads; a gap splits the
// line (two runs) and `connectNulls` joins it; the dots are visible at rest; a dashed series is dashed; horizontal bars grow
// along the inline axis (widths follow the values, RTL mirrors them) and a hovered category shows its tooltip with only the
// series that have a value.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { nonRuntimeScripts, stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("charts c: gaps, dots, dashed, horizontal bars without JS", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 1600 } });
  const seen = watch(page);
  await page.goto(s.origin + "/charts-c");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.evaluate(() => document.querySelector("[data-boot]") === null), true);
  assert.deepEqual(
    nonRuntimeScripts(seen).filter((u) => /chart/i.test(u)),
    [],
  );
  const moves = (sel: string) => page.evaluate((sel) => (document.querySelector(sel)!.getAttribute("d")!.match(/M/g) ?? []).length, sel);
  assert.equal(await moves("#gaps .chart__line"), 2);
  assert.equal(await moves("#joined .chart__line"), 1);
  // dots: visible without hover (api 4 + web 4)
  assert.equal(await page.locator("#gaps .chart__point").count(), 8);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#gaps .chart__point")!).opacity), "1");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelectorAll("#joined .chart__line")[1]!).strokeDasharray), "6px, 4px");
  // Wed has no api value: its tooltip lists Web only
  await page.hover("#gaps [data-slot=chart-slot]:nth-child(3)");
  const wed = "#gaps [data-slot=chart-slot]:nth-child(3) .chart__tooltip";
  await page.waitForFunction((sel) => getComputedStyle(document.querySelector(sel)!).opacity === "1", wed);
  assert.equal(await page.locator(`${wed} .chart__tooltip-row`).count(), 1);
  assert.match((await page.textContent(wed))!, /Wed.*Web/);
  await page.mouse.move(5, 5);
  // horizontal bars: Chrome desktop (420) is the widest; widths scale with the values
  const widths = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("#hbar .chart__bar")].map((b) => b.getBoundingClientRect().width));
  assert.equal(widths.length, 6);
  assert.ok(Math.abs(widths[0]! / widths[2]! - 420 / 180) < 0.05, `widths ${widths.join(",")}`);
  const plot = (await page.locator("#hbar .chart__plot").boundingBox())!;
  const first = (await page.locator("#hbar .chart__bar").first().boundingBox())!;
  assert.ok(Math.abs(first.x - plot.x) < 1, "bars start at the inline start");
  assert.equal(await page.locator("#hbar .chart__y-label").count(), 3);
  assert.equal(await page.locator("#hstack .chart__bar-stack").count(), 3);
  await page.focus("#hbar [data-slot=chart-slot]:nth-child(2)");
  const tip = "#hbar [data-slot=chart-slot]:nth-child(2) .chart__tooltip";
  await page.waitForFunction((sel) => getComputedStyle(document.querySelector(sel)!).display === "flex", tip);
  assert.match((await page.textContent(tip))!, /Safari.*Desktop.*180.*Mobile.*260/);
  // RTL: the bars start at the right edge of the plot
  await page.evaluate(() => document.documentElement.setAttribute("dir", "rtl"));
  const rtlPlot = (await page.locator("#hbar .chart__plot").boundingBox())!;
  const rtlFirst = (await page.locator("#hbar .chart__bar").first().boundingBox())!;
  assert.ok(Math.abs(rtlFirst.x + rtlFirst.width - (rtlPlot.x + rtlPlot.width)) < 1, "RTL bars start at the right");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
