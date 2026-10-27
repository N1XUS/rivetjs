// Field buttons (styles/TWEAKS.md TW-145, TW-169): a Button directly in an InputGroup Prefix / Suffix is concentric with the
// shell — same inset on every side, height = shell inner height − 2 × `--input-group-inset`, icon-only square, inside the
// shell. Regression (INPUTGROUP-BTN 2026-10-27): the addon's `h-full` against a shell with only a `min-height` left a
// bare 16 px icon at the shell's top end (showcase-auth password eye, docs "Icon Prefix and Copy Button" / "Password
// Toggle"). Routes: `/visual/input-group-buttons` (copy suffix, icon prefix + copy suffix, password toggle),
// `/removed-region-auth` (showcase-auth form), `/visual/theme-swap` (secondary group + primary send button).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

interface Box {
  label: string;
  group: { w: number; h: number; border: number; inset: number };
  button: { w: number; h: number; top: number; bottom: number; start: number; end: number; iconOnly: boolean };
}

/** Every Button directly in a Prefix / Suffix of a non-textarea InputGroup, measured against its shell. */
const measure = (page: Page): Promise<Box[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll(".input-group")]
      .filter((g) => !g.querySelector("[data-slot=input-group-textarea]") && g.getBoundingClientRect().width > 0)
      .flatMap((g) => {
        const gr = g.getBoundingClientRect();
        const cs = getComputedStyle(g);
        const group = { w: gr.width, h: gr.height, border: parseFloat(cs.borderTopWidth), inset: parseFloat(cs.getPropertyValue("--input-group-inset")) };
        return [...g.querySelectorAll(":scope > :is(.input-group__prefix, .input-group__suffix) > .button")].map((b) => {
          const r = b.getBoundingClientRect();
          const label = `${b.getAttribute("aria-label") ?? b.textContent?.trim()} in ${b.parentElement!.dataset.slot}`;
          return {
            label,
            group,
            button: {
              w: r.width,
              h: r.height,
              top: r.top - gr.top,
              bottom: gr.bottom - r.bottom,
              start: r.left - gr.left,
              end: gr.right - r.right,
              iconOnly: b.classList.contains("button--icon-only"),
            },
          };
        });
      }),
  );

function check(boxes: Box[], where: string, min: number) {
  assert.ok(boxes.length >= min, `${where}: ${boxes.length} field buttons (want ≥ ${min})`);
  for (const { label, group, button: b } of boxes) {
    const at = `${where} ${label}: button ${b.w.toFixed(1)}×${b.h.toFixed(1)} at top ${b.top.toFixed(1)} / bottom ${b.bottom.toFixed(1)} / start ${b.start.toFixed(1)} / end ${b.end.toFixed(1)} in a ${group.w.toFixed(1)}×${group.h.toFixed(1)} shell`;
    const fill = group.h - 2 * group.border - 2 * group.inset;
    assert.ok(Math.abs(b.h - fill) <= 0.5, `${at}: height = shell inner height − 2 × inset (${fill} px)`);
    assert.ok(Math.abs(b.top - b.bottom) <= 0.5, `${at}: vertically centred`);
    assert.ok(Math.min(b.top, b.bottom, b.start, b.end) >= group.border + group.inset - 0.5, `${at}: inside the shell (≥ border + inset from every edge)`);
    if (b.iconOnly) assert.ok(Math.abs(b.w - b.h) <= 0.5, `${at}: icon-only button is square`);
  }
}

const CASES: Array<{ route: string; min: number }> = [
  { route: "/visual/input-group-buttons", min: 3 },
  { route: "/removed-region-auth", min: 1 },
  { route: "/visual/theme-swap", min: 1 },
];

for (const width of [1280, 390])
  for (const { route, min } of CASES)
    test(`input group field buttons: ${route} @ ${width} px — square, centred, inside the shell`, async () => {
      const page = await s.browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      try {
        await page.goto(s.origin + route, { waitUntil: "networkidle" });
        // The docs frame centres the demo (`flex min-h-dvh items-center`): a field that is not stretched by its parent
        // has no definite height to lend, which is where the bug showed (the story sections stretch their demo).
        await page.addStyleTag({ content: "section[data-visual] { align-items: center; }" });
        check(await measure(page), `${route} @ ${width}`, min);
        // A bordered field (Classic preset: 1 px) and a taller shell keep the button concentric.
        await page.addStyleTag({ content: ":root { --border-width-field: 1px; } .input-group { min-height: 3rem; }" });
        check(await measure(page), `${route} @ ${width} (1 px border, 48 px shell)`, min);
      } finally {
        await page.close();
      }
    });

test("input group field buttons: icon prefix + copy suffix shell keeps its height and both addons stretch", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  try {
    await page.goto(s.origin + "/visual/input-group-buttons", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "section[data-visual] { align-items: center; }" });
    const m = await page.$eval("[data-visual=input-group-with-icon-prefix-and-copy-suffix] .input-group", (g) => {
      const slot = (n: string) => g.querySelector(`.input-group__${n}`)!.getBoundingClientRect().height;
      return { group: g.getBoundingClientRect().height, prefix: slot("prefix"), suffix: slot("suffix") };
    });
    assert.equal(m.group, 36, "default shell height (from sm) unchanged");
    assert.equal(m.suffix, 36, "suffix with a Button spans the shell");
    assert.ok(m.prefix <= 36, "icon prefix inside the shell");
  } finally {
    await page.close();
  }
});
