// Pie / Radar / Radial / Composed charts + ChartTooltip on a resumed page (`/charts-pro`; UI-PORT S6, Rivet additions with
// feature sets inspired by HeroUI Pro's public chart docs): nothing boots and no chart script loads; hovering a pie sector
// shows its (custom ChartTooltip) tooltip and dims the others, keyboard focus shows a radar category's tooltip, the radial
// ring and the composed chart's bars + dashed line render, a composed slot hover shows every series.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { nonRuntimeScripts, stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("charts pro: no JS, CSS tooltips on hover + focus", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 1400 } });
  const seen = watch(page);
  await page.goto(s.origin + "/charts-pro");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.evaluate(() => document.querySelector("[data-boot]") === null), true);
  assert.deepEqual(
    nonRuntimeScripts(seen).filter((u) => /chart|tooltip/i.test(u)),
    [],
  );
  // pie: hover the first (largest) sector at its centroid
  const first = "#pie .chart__sector:nth-of-type(1)";
  const tip = `${first} .chart__tooltip`;
  assert.equal(await page.evaluate((sel) => getComputedStyle(document.querySelector(sel)!).display, tip), "none");
  const box = (await page.locator("#pie .chart__polar").boundingBox())!;
  // the first sector (62 %) runs clockwise from 12 o'clock; its centroid sits right of and just below the centre
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.58);
  await page.waitForFunction((sel) => getComputedStyle(document.querySelector(sel)!).opacity === "1", tip);
  assert.match((await page.textContent(tip))!, /Chrome.*62%/);
  assert.ok(await page.locator(`${tip} .chart-tooltip`).count(), "custom ChartTooltip card");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#pie .chart__sector:nth-of-type(2) .chart__sector-path")!).opacity), "0.45");
  await page.mouse.move(5, 5);
  // radar: keyboard focus on a category wedge shows its dots + tooltip
  const wedge = "#radar .chart__sector:nth-of-type(2)";
  await page.focus(wedge);
  await page.waitForFunction((sel) => getComputedStyle(document.querySelector(`${sel} .chart__tooltip`)!).display === "flex", wedge);
  assert.match((await page.textContent(`${wedge} .chart__tooltip`))!, /Power.*Alpha.*64.*Beta.*88/);
  // radial ring + centre
  assert.equal(await page.locator("#radial .chart__sector-path").count(), 1);
  assert.match((await page.textContent("#radial .chart__polar-center"))!, /72%.*complete/);
  // composed: stacked bars, dashed line, slot hover shows all series
  assert.equal(await page.locator("#composed .chart__bar").count(), 10);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#composed .chart__line")!).strokeDasharray), "6px, 4px");
  await page.hover("#composed [data-slot=chart-slot]:nth-child(4)");
  const ctip = "#composed [data-slot=chart-slot]:nth-child(4) .chart__tooltip";
  await page.waitForFunction((sel) => getComputedStyle(document.querySelector(sel)!).opacity === "1", ctip);
  assert.match((await page.textContent(ctip))!, /Apr.*Online.*61.*Retail.*30.*Target.*80/);
  assert.deepEqual(seen.errors, []);
  await page.close();
});
