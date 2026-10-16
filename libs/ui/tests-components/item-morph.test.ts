// ItemMorph — resumed story app (`/item-morph`; Rivet addition, behaviour `@rivetjs/cdk/morph/item`): SSR markup (items
// marked, no panel, nothing boots at load); a mouse long press on a contact lifts it into the card (hold feedback, the
// surface grows continuously from the row box, dialog named by the item, focus on `[data-morph-autofocus]`, page inert,
// never selects); actions work inside; Escape morphs back + focus to the row; a short click still selects; right click and
// Shift+F10 open; `trigger="press"` opens the settings panel on a click; touch long press. Frame captures go to
// `ITEM_MORPH_FRAMES` (dir) when set.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const FRAMES = process.env.ITEM_MORPH_FRAMES;
const shot = async (page: Page, name: string) => {
  if (FRAMES) await page.screenshot({ path: `${FRAMES}/${name}.png` });
};

async function onPage(body: (page: Page) => Promise<void>, opts: { width?: number; reducedMotion?: "reduce" | "no-preference"; hasTouch?: boolean } = {}) {
  const page = await s.browser.newPage({
    viewport: { width: opts.width ?? 800, height: 800 },
    reducedMotion: opts.reducedMotion ?? "no-preference",
    hasTouch: opts.hasTouch,
  });
  try {
    await page.goto(s.origin + "/item-morph");
    await page.waitForLoadState("networkidle");
    await body(page);
  } finally {
    await page.close();
  }
}

const row = (id: string) => `#contacts [data-key="${id}"]`;
const SURFACE = "[data-morph-surface]";
const box = (page: Page, sel: string) =>
  page.evaluate((sel) => {
    const r = document.querySelector(sel)!.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }, sel);
/** Panel open and at rest (`data-open`, motion settled). */
const opened = (page: Page) =>
  page.waitForFunction(() => {
    const el = document.querySelector("[data-morph-surface]");
    return !!el && el.hasAttribute("data-open") && !el.hasAttribute("data-morphing");
  });
const closed = (page: Page) => page.waitForFunction(() => document.querySelector("[data-morph-surface]") === null);

async function longPress(page: Page, sel: string, ms = 700): Promise<void> {
  const b = await box(page, sel);
  await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

test("item-morph: SSR markup, items marked, no panel, no boot", async () => {
  const page = await s.browser.newPage({ viewport: { width: 800, height: 800 } });
  const seen = watch(page);
  await page.goto(s.origin + "/item-morph");
  assert.equal(await page.locator(`${row("ada")}[data-rv-morph][data-rv-long-press]`).count(), 1);
  assert.equal(await page.locator(`#settings [data-key="network"][data-rv-long-press]`).count(), 0, "press trigger: no long-press mark");
  assert.equal(await page.locator("[data-rv-item-morph-anchor]").count(), 2);
  assert.equal(await page.locator(SURFACE).count(), 0);
  await page.waitForLoadState("networkidle");
  assert.equal(await page.evaluate(() => document.querySelector("[data-boot]") === null), true);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("item-morph: long press lifts the row into the card continuously, never selects; Escape morphs back + focus to the row", () =>
  onPage(async (page) => {
    const seen = watch(page);
    const r0 = await box(page, row("ada"));
    const b = r0;
    await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
    await page.mouse.down();
    await page.waitForTimeout(330);
    // Hold feedback: the row shrinks a little while held.
    assert.equal(await page.getAttribute(row("ada"), "data-morph-holding"), "");
    const held = await box(page, row("ada"));
    assert.ok(held.w < r0.w - 1, `held row ${held.w} < ${r0.w}`);
    await shot(page, "01-hold");
    // Sample the surface from the threshold on.
    const widths: number[] = await page.evaluate(
      () =>
        new Promise<number[]>((done) => {
          const out: number[] = [];
          const tick = () => {
            const el = document.querySelector<HTMLElement>("[data-morph-surface][data-open]");
            if (el) out.push(el.getBoundingClientRect().width);
            if (out.length < 30) requestAnimationFrame(tick);
            else done(out);
          };
          requestAnimationFrame(tick);
        }),
    );
    await page.mouse.up();
    await opened(page);
    await shot(page, "03-open");
    const panel = await box(page, SURFACE);
    // The surface moves from the row width to the panel width through intermediate frames (either way round).
    const lo = Math.min(r0.w, panel.w) + 2;
    const hi = Math.max(r0.w, panel.w) - 2;
    const mid = widths.filter((w) => w > lo && w < hi);
    assert.ok(mid.length >= 3, `intermediate frames: ${widths.map((w) => Math.round(w)).join(",")}`);
    assert.ok(Math.abs(widths[0]! - r0.w) < Math.abs(r0.w - panel.w) / 2 + 2, `starts near the row width: ${widths[0]} vs ${r0.w}`);
    assert.equal(await page.getAttribute(SURFACE, "role"), "dialog");
    const adaId = await page.getAttribute(row("ada"), "id");
    assert.equal(await page.getAttribute(SURFACE, "aria-labelledby"), adaId);
    assert.equal(await page.textContent("#card-name"), "Ada Lovelace");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "card-call");
    assert.equal(await page.evaluate(() => document.querySelector("main")!.closest("[inert]") !== null), true, "page inert");
    assert.equal(await page.textContent("#chosen"), "", "a long press never selects");
    await page.click("#card-call");
    await page.waitForFunction(() => document.getElementById("called")!.textContent === "ada");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
    await shot(page, "04-closing");
    await closed(page);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-key")), "ada");
    assert.equal(await page.evaluate(() => document.querySelector("main")!.closest("[inert]") === null), true, "page interactive again");
    await shot(page, "05-closed");
    assert.deepEqual(seen.errors, []);
  }));

test("item-morph: mid-morph frame capture (frames dir only)", () =>
  onPage(async (page) => {
    if (!FRAMES) return;
    // Warm the chunks with one cycle, then capture early frames of a second morph.
    await longPress(page, row("grace"));
    await opened(page);
    await page.keyboard.press("Escape");
    await closed(page);
    const b = await box(page, row("grace"));
    await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
    await page.mouse.down();
    await page.waitForFunction(() => document.querySelector("[data-morph-surface][data-morphing]") !== null, null, { timeout: 2000 });
    await shot(page, "02-morphing");
    await page.mouse.up();
    await opened(page);
  }));

test("item-morph: a short click still selects; right click and Shift+F10 open", () =>
  onPage(async (page) => {
    await page.click(row("alan"));
    await page.waitForFunction(() => document.getElementById("chosen")!.textContent === "alan");
    assert.equal(await page.locator(SURFACE).count(), 0);
    await page.click(row("linus"), { button: "right" });
    await opened(page);
    assert.equal(await page.textContent("#card-name"), "Linus Torvalds");
    await page.click("#card-close");
    await closed(page);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-key")), "linus");
    await page.keyboard.press("ArrowUp");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-key")), "grace", "list navigation intact");
    await page.keyboard.press("Shift+F10");
    await opened(page);
    assert.equal(await page.textContent("#card-name"), "Grace Hopper");
    await page.keyboard.press("Escape");
    await closed(page);
    assert.equal(await page.textContent("#chosen"), "alan");
  }));

test("item-morph: trigger press opens the settings panel; touch long press opens the card", () =>
  onPage(
    async (page) => {
      await page.click('#settings [data-key="network"]');
      await opened(page);
      assert.equal(await page.getAttribute(SURFACE, "aria-label"), "Network settings");
      await page.click("#wifi");
      assert.equal(await page.isChecked("#wifi"), false);
      await page.click("#settings-done");
      await closed(page);
      // Touch: CDP touch events, hold past the threshold.
      const b = await box(page, row("ada"));
      const cdp = await page.context().newCDPSession(page);
      const pt = [{ x: b.x + b.w / 2, y: b.y + b.h / 2 }];
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt });
      await page.waitForTimeout(700);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await opened(page);
      assert.equal(await page.textContent("#card-name"), "Ada Lovelace");
      assert.equal(await page.textContent("#chosen"), "");
      await page.keyboard.press("Escape");
      await closed(page);
    },
    { hasTouch: true },
  ));

test("item-morph: reduced motion jumps; 375 px panel stays inside the viewport", () =>
  onPage(
    async (page) => {
      await longPress(page, row("ada"));
      await opened(page);
      const p = await box(page, SURFACE);
      assert.ok(p.x >= 15 && p.x + p.w <= 375 - 15, `panel ${p.x}+${p.w}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.keyboard.press("Escape");
      await closed(page);
    },
    { width: 375, reducedMotion: "reduce" },
  ));
