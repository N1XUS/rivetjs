// Icon boxes (identity spec §3.3, TWEAKS.md TW-140) on the `/visual/*` routes + `/icons` (`app/src/routes/icons.tsx`): each icon slot is square, sized from the
// optical set for its host text (text 12 → 14, or 12 inside a 12-px-text sm Tag; text 14 → 16; text 16 → 20), carries
// no margins, and its stroke renders at the width its size calls for (16 → 2 lucide units, 20 → 1.75, 12 / 14 → 2 px:
// lucide `absoluteStrokeWidth`).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

interface Slot {
  route: string;
  open?: string;
  /** svg selector (every visible match is checked). */
  svg: string;
  size: number;
  /** Expected stroke in lucide units (24 grid). */
  stroke: number;
}

const ABS_2PX = (size: number) => (2 * 24) / size;
const SLOTS: Record<string, Slot> = {
  "Button md / sm (text 14)": {
    route: "/visual/button",
    svg: ".button:not(.button--lg, .button--icon-only) > svg:not([data-slot=spinner] svg)",
    size: 16,
    stroke: 2,
  },
  "Button lg (text 16)": { route: "/icons", svg: ".button--lg:not(.button--icon-only) > svg", size: 20, stroke: 1.75 },
  "ToggleButton lg (text 16)": { route: "/icons", svg: ".toggle-button--lg > svg", size: 20, stroke: 1.75 },
  "Menu item submenu chevron": { route: "/icons", open: "#i-menu", svg: "[data-slot=submenu-indicator] svg", size: 16, stroke: 2 },
  "ListBox item check": {
    route: "/icons",
    svg: "[data-slot=list-box-item-indicator--checkmark]",
    size: 14,
    stroke: ABS_2PX(14),
  },
  "Tag md / lg icon": { route: "/icons", svg: ".tag:not(.tag--sm) svg", size: 14, stroke: ABS_2PX(14) },
  "Tag sm icon": { route: "/icons", svg: ".tag--sm svg", size: 12, stroke: ABS_2PX(12) },
  "SearchField clear": { route: "/visual/search-field", svg: ".search-field__clear-button [data-slot=close-button-icon]", size: 14, stroke: 2 },
  "Alert status": { route: "/visual/alert", svg: "[data-slot=alert-default-icon]", size: 16, stroke: 2 },
};

for (const [name, slot] of Object.entries(SLOTS))
  test(`icons: ${name}`, async () => {
    const page = await s.browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    try {
      await page.goto(s.origin + slot.route, { waitUntil: "networkidle" });
      if (slot.open) {
        await page.click(slot.open);
        await page.waitForTimeout(600);
      }
      const boxes = await page.$$eval(slot.svg, (els) =>
        els
          .map((el) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return { w: r.width, h: r.height, margin: cs.margin, stroke: parseFloat(cs.strokeWidth), shown: r.width > 0 && cs.visibility !== "hidden" };
          })
          .filter((b) => b.shown),
      );
      assert.ok(boxes.length > 0, `${slot.svg} rendered`);
      for (const b of boxes) {
        assert.equal(b.w, slot.size, `${name}: width ${JSON.stringify(b)}`);
        assert.equal(b.h, slot.size, `${name}: height ${JSON.stringify(b)}`);
        assert.equal(b.margin, "0px", `${name}: margins ${b.margin}`);
        assert.ok(Math.abs(b.stroke - slot.stroke) < 0.01, `${name}: stroke ${b.stroke}, want ${slot.stroke.toFixed(2)}`);
      }
    } finally {
      await page.close();
    }
  });
