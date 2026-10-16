// Morph — resumed story app (`/morph`; Rivet-authored, feature set inspired by HeroUI Pro's public MorphButton docs):
// SSR closed markup (footprint = pill, panel hidden + inert, nothing boots at load); a press on the pill morphs the surface
// continuously into the panel (sampled widths strictly between the end boxes), focus moves into the panel, layout below
// never moves; Close morphs back and focus returns to the trigger; Escape / outside press close; a press mid-morph reverses
// it (interruptible: the width turns around without reaching the panel); reduced motion / `animation="disabled"` jump;
// controlled Signal follows an outside toggle; keyboard Enter on the trigger; secondary bottom-end grows down + to the end.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>, width = 1000, reducedMotion: "reduce" | "no-preference" = "no-preference"): Promise<void> {
  const page = await s.browser.newPage({ viewport: { width, height: 800 }, reducedMotion });
  try {
    await page.goto(s.origin + "/morph");
    await page.waitForLoadState("networkidle");
    await body(page);
  } finally {
    await page.close();
  }
}

const box = (page: Page, sel: string) =>
  page.evaluate((sel) => {
    const r = document.querySelector(sel)!.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
  }, sel);

/** Waits until the morph `id` rests open / closed (the first click flushes one task later: wait for the state, not just the motion). */
const settled = (page: Page, id: string, open: boolean) =>
  page.waitForFunction(
    ([id, open]) => {
      const el = document.getElementById(id as string)!;
      return el.hasAttribute("data-open") === open && !el.hasAttribute("data-morphing");
    },
    [id, open] as const,
  );

test("morph: SSR closed markup, footprint = the pill, panel hidden + inert, no boot", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 800 } });
  const seen = watch(page);
  await page.goto(s.origin + "/morph");
  assert.equal(await page.getAttribute("#bag", "class"), "morph morph--top morph--primary");
  assert.equal(await page.getAttribute("#bag", "data-open"), null);
  assert.equal(await page.getAttribute("#bag-view", "aria-expanded"), "false");
  assert.equal(await page.getAttribute("#bag-panel", "role"), "dialog");
  assert.notEqual(await page.getAttribute("#bag-panel", "inert"), null);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("bag-panel")!).visibility), "hidden");
  const root = await box(page, "#bag");
  const surface = await box(page, "#bag [data-morph-surface]");
  assert.deepEqual([surface.w, surface.h], [root.w, root.h]);
  assert.ok(root.h >= 40 && root.h <= 52, `pill height ${root.h}`);
  await page.waitForLoadState("networkidle");
  assert.equal(await page.evaluate(() => document.querySelector("[data-boot]") === null), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("morph: press morphs continuously into the panel, focus inside, siblings never move; Close morphs back + focus to the trigger", () =>
  onPage(async (page) => {
    const after0 = await box(page, "#after");
    const pill = await box(page, "#bag");
    await page.click("#bag-view");
    // Sample the surface while it grows: widths strictly between the pill and the panel.
    const widths: number[] = await page.evaluate(
      () =>
        new Promise<number[]>((done) => {
          const out: number[] = [];
          const el = document.querySelector<HTMLElement>("#bag [data-morph-surface]")!;
          const tick = () => {
            out.push(el.getBoundingClientRect().width);
            if (out.length < 40) requestAnimationFrame(tick);
            else done(out);
          };
          requestAnimationFrame(tick);
        }),
    );
    await settled(page, "bag", true);
    const panel = await box(page, "#bag [data-morph-surface]");
    const mid = widths.filter((w) => w > pill.w + 2 && w < panel.w - 2);
    assert.ok(mid.length >= 3, `intermediate frames: ${widths.map((w) => Math.round(w)).join(",")}`);
    assert.ok(panel.w >= 300 && panel.h > pill.h * 2, `panel ${panel.w}×${panel.h}`);
    // Pinned bottom-centre (direction top).
    assert.ok(Math.abs(panel.bottom - pill.bottom) < 1.5, "bottom pinned");
    assert.ok(Math.abs(panel.x + panel.w / 2 - (pill.x + pill.w / 2)) < 1.5, "centred");
    assert.equal(await page.getAttribute("#bag", "data-open"), "");
    assert.equal(await page.getAttribute("#bag-view", "aria-expanded"), "true");
    assert.equal(await page.getAttribute("#bag-panel", "inert"), null);
    assert.equal(await page.evaluate(() => document.getElementById("bag-panel")!.contains(document.activeElement)), true);
    assert.deepEqual(await box(page, "#after"), after0);
    // At rest no inline styles remain.
    assert.equal((await page.evaluate(() => document.querySelector<HTMLElement>("#bag [data-morph-surface]")!.getAttribute("style"))) ?? "", "");
    // Buy now works inside; Keep shopping morphs back.
    await page.click("#bag-buy");
    await page.waitForFunction(() => document.getElementById("bag-bought")!.textContent === "1");
    await page.click("#bag-keep");
    await settled(page, "bag", false);
    assert.equal(await page.getAttribute("#bag", "data-open"), null);
    const back = await box(page, "#bag [data-morph-surface]");
    assert.deepEqual([Math.round(back.w), Math.round(back.h)], [Math.round(pill.w), Math.round(pill.h)]);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "bag-view");
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("bag-panel")!).visibility), "hidden");
  }));

test("morph: Escape and an outside press close it", () =>
  onPage(async (page) => {
    await page.click("#bag-view");
    await settled(page, "bag", true);
    await page.keyboard.press("Escape");
    await settled(page, "bag", false);
    assert.equal(await page.getAttribute("#bag", "data-open"), null);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "bag-view");
    await page.click("#bag-view");
    await settled(page, "bag", true);
    await page.click("#bag-bought");
    await settled(page, "bag", false);
    assert.equal(await page.getAttribute("#bag", "data-open"), null);
  }));

test("morph: interruptible: Escape mid-morph turns the surface around before it reaches the panel", () =>
  onPage(async (page) => {
    // Warm the chunks with one full cycle first.
    await page.click("#bag-view");
    await settled(page, "bag", true);
    await page.keyboard.press("Escape");
    await settled(page, "bag", false);
    const pill = await box(page, "#bag");
    await page.click("#bag-view");
    await page.waitForFunction((w) => document.querySelector<HTMLElement>("#bag [data-morph-surface]")!.getBoundingClientRect().width > w + 40, pill.w);
    await page.keyboard.press("Escape");
    const peak: number = await page.evaluate(
      () =>
        new Promise<number>((done) => {
          let max = 0;
          const el = document.querySelector<HTMLElement>("#bag [data-morph-surface]")!;
          const tick = () => {
            max = Math.max(max, el.getBoundingClientRect().width);
            if (document.getElementById("bag")!.hasAttribute("data-morphing")) requestAnimationFrame(tick);
            else done(max);
          };
          tick();
        }),
    );
    assert.ok(peak < 300, `reversed before the panel width (peak ${peak})`);
    assert.equal(await page.getAttribute("#bag", "data-open"), null);
  }));

test("morph: keyboard Enter on the trigger opens; Tab out of the panel closes", () =>
  onPage(async (page) => {
    await page.focus("#bag-view");
    await page.keyboard.press("Enter");
    await settled(page, "bag", true);
    assert.equal(await page.getAttribute("#bag", "data-open"), "");
    assert.equal(await page.evaluate(() => document.getElementById("bag-panel")!.contains(document.activeElement)), true);
    // Keep shopping → Buy now → the button after the morph (focus leaves the root).
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "after");
    await settled(page, "bag", false);
    assert.equal(await page.getAttribute("#bag", "data-open"), null);
  }));

test("morph: reduced motion and animation disabled jump (no intermediate frame)", async () => {
  await onPage(
    async (page) => {
      await page.click("#bag-view");
      await page.waitForFunction(() => document.getElementById("bag")!.hasAttribute("data-open"));
      assert.equal(await page.getAttribute("#bag", "data-morphing"), null);
    },
    1000,
    "reduce",
  );
  await onPage(async (page) => {
    await page.click("#still-view");
    await page.waitForFunction(() => document.getElementById("still")!.hasAttribute("data-open"));
    assert.equal(await page.getAttribute("#still", "data-morphing"), null);
    await page.click("#still-close");
    await page.waitForFunction(() => !document.getElementById("still")!.hasAttribute("data-open"));
  });
});

test("morph: controlled Signal follows an outside toggle", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 800 } });
  try {
    await page.goto(s.origin + "/morph-controlled");
    await page.waitForLoadState("networkidle");
    await page.click("#ctl-toggle");
    await page.waitForFunction(() => document.getElementById("ctl")!.hasAttribute("data-open"));
    await settled(page, "ctl", true);
    assert.equal(await page.textContent("#ctl-state"), "open");
    await page.click("#ctl [data-slot=morph-close]");
    await settled(page, "ctl", false);
    assert.equal(await page.getAttribute("#ctl", "data-open"), null);
    await page.waitForFunction(() => document.getElementById("ctl-state")!.textContent === "closed");
  } finally {
    await page.close();
  }
});

test("morph: secondary bottom-end grows down and to the end", () =>
  onPage(async (page) => {
    const pill = await box(page, "#sec");
    await page.click("#sec-view");
    await settled(page, "sec", true);
    const panel = await box(page, "#sec [data-morph-surface]");
    assert.ok(Math.abs(panel.y - pill.y) < 1.5 && Math.abs(panel.x - pill.x) < 1.5, "top-start corner pinned");
    assert.ok(panel.h > pill.h && panel.w > pill.w);
  }));

test("morph: 375 px phone width, no horizontal scroll when open", () =>
  onPage(async (page) => {
    await page.click("#bag-view");
    await settled(page, "bag", true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }, 375));
