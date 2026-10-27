// KpiGroup / NumberValue / Widget / ItemCard(Group) / Timeline on a resumed page (`/display-pro`; Rivet additions, feature
// sets inspired by HeroUI Pro's public docs): pure markup + CSS, nothing boots and no component script loads; KpiGroup
// cards drop their own surface and share the row; Widget legend dot colour; ItemCardGroup list rows are transparent with
// hairline dividers, a link row gets the focus ring; grid columns from `columns`; Timeline: default rail hidden when the
// item has its own, last connector hidden, centred alternate / side overrides; 375 px no horizontal scroll.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { nonRuntimeScripts, stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("display pro: no boot, no component scripts, layout from CSS", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1100, height: 1400 } });
  const seen = watch(page);
  await page.goto(s.origin + "/display-pro");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.evaluate(() => document.querySelector("[data-boot]") === null), true);
  assert.deepEqual(
    nonRuntimeScripts(seen).filter((u) => /kpi|number-value|widget|item-card|timeline/i.test(u)),
    [],
  );
  const r = await page.evaluate(() => {
    const css = (sel: string) => getComputedStyle(document.querySelector(sel)!);
    const box = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
    const kpis = [...document.querySelectorAll("#kg > .kpi")].map((el) => el.getBoundingClientRect());
    return {
      kgShadow: css("#kg").boxShadow !== "none",
      kpiBg: css("#kg > .kpi").backgroundColor,
      kpiRow: kpis[0]!.top === kpis[1]!.top && Math.abs(kpis[0]!.width - kpis[1]!.width) < 2,
      sepWidth: box("#kg .kpi-group__separator").width,
      nv: document.querySelector("#nv")!.textContent,
      dot: css("#wg .widget__legend-item-dot").backgroundColor,
      rowBg: css("#icg > .item-card:nth-child(1)").backgroundColor,
      hairline: getComputedStyle(document.querySelector("#icg > .item-card:nth-child(2)")!, "::before").height,
      firstNoHairline: getComputedStyle(document.querySelector("#icg > .item-card:nth-child(1)")!, "::before").content,
      gridCols: css("#icg-grid").gridTemplateColumns.split(" ").length,
      defaultRailOwn: css("#tl-own > .timeline__rail--default").display,
      defaultRailPlain: css("#tl > li:first-child > .timeline__rail--default").display,
      lastConnector: css("#tl > li:last-child .timeline__connector").display,
      ownMarkerVisible: box("#tl-own .timeline__rail:not(.timeline__rail--default) .timeline__marker:not(.timeline__marker--default)").width > 0,
      ownDefaultMarker: css("#tl-own .timeline__rail:not(.timeline__rail--default) .timeline__marker--default").display,
      ariaCurrent: document.querySelector("#tl-own")!.getAttribute("aria-current"),
      centre: [...document.querySelectorAll("#tl-center .timeline__content")].map((el) => {
        const c = el.getBoundingClientRect();
        const rail = el.parentElement!.querySelector(".timeline__rail--default")!.getBoundingClientRect();
        return c.left >= rail.right ? "end" : "start";
      }),
    };
  });
  assert.deepEqual(r, {
    kgShadow: true,
    kpiBg: "rgba(0, 0, 0, 0)",
    kpiRow: true,
    sepWidth: 1,
    nv: "~1.5Musers",
    dot: "rgb(255, 0, 0)",
    rowBg: "rgba(0, 0, 0, 0)",
    hairline: "1px",
    firstNoHairline: "none",
    gridCols: 3,
    defaultRailOwn: "none",
    defaultRailPlain: "flex",
    lastConnector: "none",
    ownMarkerVisible: true,
    ownDefaultMarker: "none",
    ariaCurrent: "true",
    centre: ["end", "start", "end", "end"],
  });
  // a link row is focusable and shows the focus ring
  await page.focus("#icg a.item-card");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement!).boxShadow), "none");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("display pro: 375 px no horizontal scroll, grid falls back to one column", async () => {
  const page = await s.browser.newPage({ viewport: { width: 375, height: 800 } });
  await page.goto(s.origin + "/display-pro");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#icg-grid")!).gridTemplateColumns.split(" ").length), 1);
  await page.close();
});
