// Rating / TrendChip / Kpi / charts on a resumed page (`/data-display-pro`; Rivet additions, feature sets inspired by HeroUI
// Pro's public docs): nothing boots and no component script loads at rest (charts are markup + CSS); chart tooltips
// show on hover and keyboard focus with CSS only; interactive Rating: click selects (two-way signal), hover previews,
// arrow keys move the native radio; read-only rating fill; 375 px no horizontal scroll.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { nonRuntimeScripts, stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("data display: no boot, CSS applied, chart tooltip on hover + focus without JS", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 900 } });
  const seen = watch(page);
  await page.goto(s.origin + "/data-display-pro");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.evaluate(() => document.querySelector("[data-boot]") === null), true);
  const scripts = nonRuntimeScripts(seen).filter((u) => /chart|kpi|trend|Sparkline|AreaChart|BarChart|Donut/i.test(u));
  assert.deepEqual(scripts, []);
  // plot height from --chart-height
  assert.equal(await page.evaluate(() => document.querySelector("#area .chart__plot")!.getBoundingClientRect().height), 240);
  const tip = "#area [data-slot=chart-slot]:nth-child(4) .chart__tooltip";
  assert.equal(await page.evaluate((sel) => getComputedStyle(document.querySelector(sel)!).display, tip), "none");
  await page.hover("#area [data-slot=chart-slot]:nth-child(4)");
  await page.waitForFunction((sel) => getComputedStyle(document.querySelector(sel)!).opacity === "1", tip);
  assert.match((await page.textContent(tip))!, /Apr.*Visits.*5,200.*Signups.*690/);
  await page.mouse.move(5, 5);
  // keyboard: focus the first bar group
  const slot = "#bar [data-slot=chart-slot]:nth-child(2)";
  await page.$eval(slot, (el) => ((el as unknown as Record<string, boolean>).__server = true));
  await page.focus(slot);
  await page.waitForFunction(() => getComputedStyle(document.querySelector("#bar [data-slot=chart-slot]:nth-child(2) .chart__tooltip")!).display === "flex");
  // The first focus adopts the page: the chart keeps its server nodes, its tooltips and the focus. Was: the chart's
  // positional-argument helpers (`Frame(…)` / `Tooltip(…)`, capitalised) compiled as boundaries, rendered nothing for the
  // tooltip in the browser, so the frame re-rendered: tooltips gone, focus on <body>.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
  assert.deepEqual(
    await page.evaluate((sel) => {
      const el = document.querySelector(sel)!;
      return {
        server: (el as unknown as Record<string, boolean>).__server === true,
        focused: document.activeElement === el,
        tooltip: getComputedStyle(el.querySelector(".chart__tooltip")!).display,
      };
    }, slot),
    { server: true, focused: true, tooltip: "flex" },
  );
  // bars: stacked heights sum below the plot height
  const h = await page.evaluate(() =>
    [...document.querySelectorAll("#bar [data-slot=chart-slot]:nth-child(5) .chart__bar")].map((b) => b.getBoundingClientRect().height),
  );
  assert.ok(h.length === 2 && h[0]! > h[1]! && h[0]! + h[1]! <= 240, String(h));
  assert.equal(await page.evaluate(() => document.querySelectorAll("#donut .chart__donut-segment").length), 3);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("rating: click, hover preview, arrow keys; read-only fill", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 900 } });
  await page.goto(s.origin + "/data-display-pro");
  await page.waitForLoadState("networkidle");
  const filled = () =>
    page.evaluate(() => [...document.querySelectorAll("#rt .rating__item")].map((el) => getComputedStyle(el).getPropertyValue("--rating-fill").trim()));
  assert.deepEqual(await filled(), ["100%", "100%", "100%", "0%", "0%"]);
  await page.hover("#rt .rating__item:nth-child(5)");
  assert.deepEqual(await filled(), ["100%", "100%", "100%", "100%", "100%"]);
  await page.click("#rt .rating__item:nth-child(4)");
  await page.waitForFunction(() => document.getElementById("rt-value")!.textContent === "4");
  await page.mouse.move(5, 500);
  assert.deepEqual(await filled(), ["100%", "100%", "100%", "100%", "0%"]);
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => document.getElementById("rt-value")!.textContent === "3");
  assert.equal(await page.evaluate(() => (document.activeElement as HTMLInputElement).value), "3");
  const ro = await page.evaluate(() =>
    [...document.querySelectorAll("#rt-ro .rating__item")].map((el) => (el as HTMLElement).style.getPropertyValue("--rating-fill")),
  );
  assert.deepEqual(ro, ["100%", "100%", "100%", "100%", "30%"]);
  await page.close();
});

test("data display: 375 px no horizontal scroll", async () => {
  const page = await s.browser.newPage({ viewport: { width: 375, height: 800 } });
  await page.goto(s.origin + "/data-display-pro");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.close();
});
