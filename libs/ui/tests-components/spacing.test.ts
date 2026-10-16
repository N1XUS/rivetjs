// Hit targets and density (identity spec §3.2, TWEAKS.md TW-138 / TW-139) on the `/spacing` story route: a control without
// label text answers presses ≥ 12 px from its centre on fine pointers (24 × 24, WCAG 2.5.8) and ≥ 22 px on coarse
// pointers (44 × 44; Playwright `hasTouch` → `(pointer: coarse)`), visual size unchanged; `data-density="compact"` shifts
// control height and padding one scale step, a nested `data-density="comfortable"` restores the default.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(touch: boolean, body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce", hasTouch: touch });
  try {
    await page.goto(s.origin + "/spacing", { waitUntil: "networkidle" });
    await body(page);
  } finally {
    await page.close();
  }
}

/** For each target: its visual size and whether the points `reach` px left / right / above / below its centre hit it. */
const probe = (page: Page, reach: number) =>
  page.evaluate((r) => {
    const targets: Record<string, string> = {
      checkbox: "[data-testid=t-checkbox] .checkbox__content",
      radio: "[data-testid=t-radio] .radio__content",
      switch: "[data-testid=t-switch] .switch__content",
      close: "#t-close",
    };
    return Object.fromEntries(
      Object.entries(targets).map(([name, sel]) => {
        const el = document.querySelector(sel)!;
        const box = el.getBoundingClientRect();
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        const hits = [
          [cx - r, cy],
          [cx + r, cy],
          [cx, cy - r],
          [cx, cy + r],
        ].map(([x, y]) => {
          const at = document.elementFromPoint(x!, y!);
          return !!at && (el === at || el.contains(at));
        });
        return [name, { w: box.width, h: box.height, hits }];
      }),
    );
  }, reach);

test("hit targets: ≥ 24 × 24 on fine pointers, visual size unchanged", () =>
  onPage(false, async (page) => {
    assert.equal(await page.evaluate(() => matchMedia("(pointer: coarse)").matches), false);
    const m = await probe(page, 11.5);
    for (const [name, t] of Object.entries(m)) {
      assert.ok(t.hits.every(Boolean), `${name}: ${JSON.stringify(t)}`);
      assert.ok(t.w <= 40 && t.h <= 24, `${name} visual ${t.w}×${t.h}`);
    }
  }));

test("hit targets: ≥ 44 × 44 on coarse pointers (hasTouch), visual size unchanged", () =>
  onPage(true, async (page) => {
    assert.equal(await page.evaluate(() => matchMedia("(pointer: coarse)").matches), true);
    const m = await probe(page, 21.5);
    for (const [name, t] of Object.entries(m)) {
      assert.ok(t.hits.every(Boolean), `${name}: ${JSON.stringify(t)}`);
      assert.ok(t.w <= 40 && t.h <= 24, `${name} visual ${t.w}×${t.h}`);
    }
  }));

test("density: compact shifts height / padding one step, comfortable restores", () =>
  onPage(false, async (page) => {
    const read = (root: string) =>
      page.evaluate((r) => {
        const box = (sel: string) => {
          const el = document.querySelector(`${r} ${sel}`)!;
          const cs = getComputedStyle(el);
          return { h: Math.round(el.getBoundingClientRect().height), px: parseFloat(cs.paddingInlineStart) };
        };
        return { md: box(".d-md"), sm: box(".d-sm"), lg: box(".d-lg"), input: box(".d-input"), item: box(".list-box-item") };
      }, root);
    const normal = await read("#d-default");
    const compact = await read("#d-compact");
    const restored = await read("#d-restored");
    assert.deepEqual(normal, {
      md: { h: 36, px: 16 },
      sm: { h: 32, px: 12 },
      lg: { h: 40, px: 20 },
      input: normal.input,
      item: normal.item,
    });
    assert.deepEqual(compact.md, { h: 32, px: 12 });
    assert.deepEqual(compact.sm, { h: 28, px: 8 });
    assert.deepEqual(compact.lg, { h: 36, px: 16 });
    assert.equal(compact.input.h, normal.input.h - 4, "input: py 8 → 6");
    assert.equal(compact.item.h, 32, "list item: min-h 36 → 32");
    assert.equal(normal.item.h, 36);
    assert.deepEqual(restored, normal);
  }));
