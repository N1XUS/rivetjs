// Concentric radii (identity spec §3.1, TWEAKS.md TW-123): for each nest, the child's corner radius = max(parent radius −
// inset, --r-min) where inset = the child's distance from the parent's corner (padding + border). Pills (Button, Chip,
// Tag, Tab) are exempt unless `data-radius="concentric"`. Story routes: `/visual/<name>` (overlays opened) + `/geometry`.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const R_MIN = 4;

interface Nest {
  route: string;
  open?: string[];
  parent: string;
  child: string;
  /** Expected floor (default R_MIN). */
  min?: number;
}

const NESTS: Record<string, Nest> = {
  "dropdown popover → menu item": { route: "/visual/dropdown", open: ["button"], parent: ".dropdown__popover", child: "[data-slot=menu-item]" },
  "select popover → list-box item": { route: "/visual/select", open: ["[data-slot=select-trigger]"], parent: ".select__popover", child: ".list-box-item" },
  "combo-box popover → list-box item": {
    route: "/visual/combo-box",
    open: ["[data-slot=combo-box-trigger]"],
    parent: ".combo-box__popover",
    child: ".list-box-item",
  },
  "popover dialog → nested Card": { route: "/geometry", open: ["#g-po-trigger"], parent: ".popover", child: "#g-po-card" },
  "Card → nested Card": { route: "/geometry", parent: "#g-outer", child: "#g-nested" },
  "modal dialog → nested Card (floor)": { route: "/geometry", open: ["#g-mo-trigger"], parent: ".modal__dialog", child: "#g-mo-card" },
  "color picker popover → color area": {
    route: "/visual/color-picker",
    open: ["[data-slot=color-picker-trigger]"],
    parent: ".color-picker__popover",
    child: ".color-area",
  },
  "date picker popover → year cell": {
    route: "/visual/date-picker",
    open: ["[data-slot=date-picker-trigger]", ".calendar-year-picker__trigger"],
    parent: ".date-picker__popover",
    child: ".calendar-year-picker__year-grid[data-open=true] .calendar-year-picker__year-cell",
  },
  "input group shell → prefix addon": { route: "/visual/input-group", parent: ".input-group", child: ".input-group__prefix", min: 0 },
  "number field group → decrement button": { route: "/visual/number-field", parent: ".number-field__group", child: ".number-field__decrement-button", min: 0 },
  "Card → concentric Button (radius=concentric)": { route: "/geometry", parent: "#g-corner", child: "#g-concentric" },
};

async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  try {
    await body(page);
  } finally {
    await page.close();
  }
}

/** Corner radius, rect and the child's inset from the parent's start-start corner (the nearer of the two edges). */
const measure = (page: Page, parent: string, child: string) =>
  page.evaluate(
    ([p, c]) => {
      const pe = document.querySelector(p)!;
      const ce = [...pe.querySelectorAll(c)].find((el) => el.getBoundingClientRect().width > 0)!;
      const pr = pe.getBoundingClientRect();
      const cr = ce.getBoundingClientRect();
      const radius = (el: Element) => parseFloat(getComputedStyle(el).borderStartStartRadius);
      return { parentR: radius(pe), childR: radius(ce), inset: Math.min(cr.left - pr.left, cr.top - pr.top), height: cr.height };
    },
    [parent, child] as const,
  );

for (const [name, nest] of Object.entries(NESTS))
  test(`geometry: ${name}`, () =>
    onPage(async (page) => {
      await page.goto(s.origin + nest.route, { waitUntil: "networkidle" });
      for (const selector of nest.open ?? []) {
        await page.click(selector);
        await page.waitForTimeout(700);
      }
      // A scrolling grid (year picker) at its start: its first cell sits in the parent's corner.
      await page.evaluate(() => document.querySelectorAll(".calendar-year-picker__year-grid").forEach((el) => (el.scrollTop = 0)));
      await page.waitForSelector(`${nest.parent} ${nest.child}`, { state: "visible" });
      const m = await measure(page, nest.parent, nest.child);
      const want = Math.max(m.parentR - m.inset, nest.min ?? R_MIN);
      assert.ok(m.parentR > 0, `${nest.parent} is rounded`);
      assert.ok(Math.abs(m.childR - want) <= 0.5, `${name}: child radius ${m.childR} px, parent ${m.parentR} px − inset ${m.inset} px → ${want} px`);
    }));

test("geometry: pills stay pills (Button in a Card corner without radius=concentric, vertical tabs)", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/geometry", { waitUntil: "networkidle" });
    const pill = await measure(page, "#g-corner", "#g-pill");
    assert.ok(pill.childR >= pill.height / 2 - 0.5, `button pill: ${pill.childR} px for ${pill.height} px`);
    await page.goto(s.origin + "/visual/tabs", { waitUntil: "networkidle" });
    const tabs = await page.$$eval(".tabs__list[data-orientation=vertical] .tabs__tab", (els) =>
      els.map((el) => ({ r: parseFloat(getComputedStyle(el).borderStartStartRadius), h: el.getBoundingClientRect().height })),
    );
    assert.ok(tabs.length > 0, "vertical tabs rendered");
    for (const t of tabs) assert.ok(t.r >= t.h / 2, `vertical tab ${t.r} px for ${t.h} px`);
  }));

test("geometry: list items keep their own radius outside a popover (no leak from a Card)", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/visual/list-box", { waitUntil: "networkidle" });
    const r = await page.$eval(".list-box-item", (el) => parseFloat(getComputedStyle(el).borderStartStartRadius));
    assert.equal(r, 16);
  }));
