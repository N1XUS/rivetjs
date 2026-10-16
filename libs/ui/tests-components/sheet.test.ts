// Sheet — resumed story app (`/sheet`, `/sheet-open`; Rivet-authored, feature set inspired by HeroUI Pro's public Sheet docs):
// SSR closed markup, focus trap + scroll lock + Escape focus restore, flick on the handle dismisses, a slow short drag settles
// back, a scrolled body is not hijacked (drag abandoned, wheel scrolls), snap points (rest at 30 %, drag up → 60 %, flick
// down closes), non-modal (outside stays usable, Escape), nested (parent steps back), right placement drag, and a sheet open
// in the server HTML drags on the resumed page.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { assertFades, stories, traceFade, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const H = 700;

async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: H } });
  try {
    await body(page);
  } finally {
    await page.close();
  }
}

const scrollLocked = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).overflow === "hidden" || getComputedStyle(document.body).overflow === "hidden");

/** Mouse drag from the centre of `selector` by (dx, dy) in `steps` moves, `delay` ms apart. */
async function drag(page: Page, selector: string, dx: number, dy: number, steps: number, delay: number): Promise<void> {
  const box = (await page.locator(selector).boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps);
    if (delay) await page.waitForTimeout(delay);
  }
  await page.mouse.up();
}

// The drag / snap motion runs on rAF (not Web Animations): `data-dragging` stays until it settles.
const settled = (page: Page) =>
  page.waitForFunction(
    () =>
      !document.querySelector("[data-entering]") &&
      !document.querySelector("[data-dragging]") &&
      document.getAnimations().every((a) => a.playState !== "running"),
  );

async function open(page: Page, trigger: string, dialog: string): Promise<void> {
  await page.click(trigger);
  await page.waitForSelector(dialog);
  await settled(page);
}

test("sheet: SSR closed markup (trigger only), no errors", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/sheet");
    assert.equal(await page.$("#sh-dialog"), null);
    assert.equal(await page.getAttribute("#sh-trigger", "class"), "sheet__trigger");
    assert.equal(await page.getAttribute("#sh-trigger", "data-slot"), "sheet-trigger");
    await page.waitForLoadState("networkidle");
    assert.deepEqual(seen.errors, []);
  }));

test("sheet: focus trap, scroll lock, docked at the bottom, Escape restores focus", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/sheet");
    await page.click("#sh-trigger");
    await page.waitForSelector("#sh-dialog");
    await page.waitForFunction(() => document.getElementById("sh-dialog")!.contains(document.activeElement));
    await page.waitForFunction(() => getComputedStyle(document.documentElement).overflow === "hidden" || getComputedStyle(document.body).overflow === "hidden");
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      assert.ok(await page.evaluate(() => document.getElementById("sh-dialog")!.contains(document.activeElement)), `tab ${i} left the dialog`);
    }
    await settled(page);
    const box = (await page.locator("#sh-dialog").boundingBox())!;
    assert.ok(Math.abs(box.y + box.height - H) < 2, `bottom edge ${box.y + box.height}`);
    assert.equal(box.width, 1000);
    await page.keyboard.press("Escape");
    await page.waitForSelector("#sh-dialog", { state: "detached" });
    assert.equal(await scrollLocked(page), false);
    await page.waitForFunction(() => document.activeElement?.id === "sh-trigger");
    assert.equal(await page.textContent("#sh-state"), "false");
    assert.deepEqual(seen.errors, []);
  }));

test("sheet: a flick down on the handle dismisses", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/sheet");
    await open(page, "#sh-trigger", "#sh-dialog");
    await drag(page, "#sh-handle", 0, 80, 4, 0);
    await page.waitForSelector("#sh-dialog", { state: "detached" });
    assert.equal(await page.textContent("#sh-state"), "false");
  }));

test("sheet: a slow short drag settles back (inline transform cleared)", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/sheet");
    await open(page, "#sh-trigger", "#sh-dialog");
    await drag(page, "#sh-handle", 0, 40, 20, 40);
    await page.waitForFunction(() => document.getElementById("sh-dialog")!.style.transform === "", undefined, { timeout: 3000 });
    assert.ok(await page.$("#sh-dialog"));
    assert.equal(await page.textContent("#sh-state"), "true", "still open (no onOpenChange(false))");
  }));

test("sheet: a scrolled body is not hijacked (drag abandoned, wheel scrolls the body)", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/sheet");
    await open(page, "#sh-trigger", "#sh-dialog");
    const box = (await page.locator("#sh-scroll").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 200);
    await page.waitForFunction(() => document.getElementById("sh-scroll")!.scrollTop > 50);
    assert.equal(await page.$eval("#sh-dialog", (el) => (el as HTMLElement).style.transform), "");
    await drag(page, "#sh-scroll", 0, 200, 10, 16);
    await page.waitForTimeout(200);
    assert.ok(await page.$("#sh-dialog"));
    assert.equal(await page.$eval("#sh-dialog", (el) => (el as HTMLElement).style.transform), "");
  }));

test("sheet snap points: rests at 30 %, drag up snaps to 60 %, flick down closes", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/sheet");
    await open(page, "#sh-snap-trigger", "#sh-snap");
    assert.equal(await page.getAttribute("#sh-snap", "data-sheet-snap-points"), "true");
    let box = (await page.locator("#sh-snap").boundingBox())!;
    assert.ok(Math.abs(box.y - H * 0.7) < 3, `top at 30 %: ${box.y}`);
    await drag(page, "#sh-snap-handle", 0, -H * 0.3, 20, 30);
    await page.waitForFunction(() => document.getElementById("sh-snap-point")!.textContent === "0.6");
    await settled(page);
    box = (await page.locator("#sh-snap").boundingBox())!;
    assert.ok(Math.abs(box.y - H * 0.4) < 3, `top at 60 %: ${box.y}`);
    await drag(page, "#sh-snap-handle", 0, 300, 4, 0);
    await page.waitForSelector("#sh-snap", { state: "detached" });
    assert.deepEqual(seen.errors, []);
  }));

test("sheet isModal={false}: outside stays usable, no scroll lock, Escape closes", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/sheet");
    await open(page, "#sh-modeless-trigger", "#sh-modeless");
    assert.equal(await page.$("[data-slot=sheet-backdrop]"), null);
    assert.equal(await scrollLocked(page), false);
    await page.click("#sh-outside");
    await page.waitForFunction(() => document.getElementById("sh-outside-count")!.textContent === "1");
    assert.ok(await page.$("#sh-modeless"));
    await page.focus("#sh-modeless");
    await page.keyboard.press("Escape");
    await page.waitForSelector("#sh-modeless", { state: "detached" });
  }));

test("sheet nested: the parent steps back while the nested sheet is open", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/sheet");
    await open(page, "#sh-parent-trigger", "#sh-parent");
    await open(page, "#sh-child-trigger", "#sh-child");
    assert.equal(await page.getAttribute("#sh-parent", "data-sheet-nested-open"), "true");
    await page.keyboard.press("Escape");
    await page.waitForSelector("#sh-child", { state: "detached" });
    assert.equal(await page.getAttribute("#sh-parent", "data-sheet-nested-open"), null);
    assert.ok(await page.$("#sh-parent"));
  }));

test("sheet right placement: docks right, drag right dismisses", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/sheet");
    await open(page, "#sh-right-trigger", "#sh-right");
    const box = (await page.locator("#sh-right").boundingBox())!;
    assert.ok(Math.abs(box.x + box.width - 1000) < 2, `right edge ${box.x + box.width}`);
    await drag(page, "#sh-right-header", Math.ceil(box.width * 0.6), 0, 12, 16);
    await page.waitForSelector("#sh-right", { state: "detached" });
  }));

test("sheet: open in the server HTML — drag works on the resumed page", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/sheet-open");
    assert.ok(await page.$("#sho-dialog"));
    assert.match((await page.getAttribute("#sho-dialog", "style"))!, /translateY/);
    await page.waitForLoadState("networkidle");
    await drag(page, "#sho-handle", 0, 300, 4, 0);
    await page.waitForSelector("#sho-dialog", { state: "detached" });
    assert.deepEqual(seen.errors, []);
  }));

// BACKDROP-FIX (2026-10-08): the backdrop's opacity transition (`sheet.css` `[data-entering]` / `[data-exiting]`) runs on open and
// close, the panel slides; the first open of the resumed page and a later browser-created open.
test("sheet: backdrop fades in and out, panel slides (first open + reopen)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/sheet");
    for (const round of ["first open", "reopen"]) {
      const backdrop = await traceFade(page, "[data-slot=sheet-backdrop]");
      const panel = await traceFade(page, "#sh-dialog");
      await page.click("#sh-trigger");
      await page.waitForSelector("#sh-dialog");
      await settled(page);
      await page.waitForTimeout(150);
      const closedAt = await backdrop.now();
      await page.keyboard.press("Escape");
      await page.waitForSelector("[data-slot=sheet-backdrop]", { state: "detached" });
      await page.waitForTimeout(100);
      assertFades(await backdrop.samples(), closedAt, `sheet backdrop (${round})`);
      const slides = await panel.samples();
      assert.ok(
        slides.some((p) => !p.gone && p.t < closedAt && p.running > 0),
        `panel slides in (${round})`,
      );
      assert.ok(
        slides.some((p) => !p.gone && p.t >= closedAt && p.running > 0),
        `panel slides out (${round})`,
      );
      await page.waitForFunction(() => document.activeElement?.id === "sh-trigger");
    }
    assert.deepEqual(seen.errors, []);
  }));

// BACKDROP-FIX (2026-10-08, "sheet - backdrop blur not transitioned"): the blur variant's `backdrop-filter` radius follows the fade
// (0 → 12 px on enter, 12 → 0 px on exit, strictly between mid-way) and the drag (`--sheet-backdrop-opacity`), instead of popping
// in at the end of the fade (a `::before` blur inside the fading element had no backdrop).
test("sheet: blur backdrop radius transitions on enter / exit and follows the drag", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/sheet");
    const trace = await traceFade(page, "[data-slot=sheet-backdrop]", 10000);
    await open(page, "#sh-right-trigger", "#sh-right");
    const atRest = await page.$eval("[data-slot=sheet-backdrop]", (el) => getComputedStyle(el).backdropFilter);
    assert.equal(atRest, "blur(12px)");
    // Drag right a third of the width (below the dismiss threshold), hold: the radius drops with the backdrop opacity.
    const box = (await page.locator("#sh-right").boundingBox())!;
    const header = (await page.locator("#sh-right-header").boundingBox())!;
    const x = header.x + header.width / 2,
      y = header.y + header.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x + (box.width * 0.25 * i) / 8, y);
    await page.waitForTimeout(50);
    const dragged = await page.$eval("[data-slot=sheet-backdrop]", (el) => Number(/blur\(([\d.]+)px\)/.exec(getComputedStyle(el).backdropFilter)?.[1] ?? -1));
    assert.ok(dragged > 0 && dragged < 12, `blur while dragged: ${dragged}`);
    // Back to the start slowly before releasing (no flick): the sheet settles open again.
    for (let i = 7; i >= 0; i--) {
      await page.mouse.move(x + (box.width * 0.25 * i) / 8, y);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(100);
    await page.mouse.up();
    assert.ok(await page.$("#sh-right"), "still open after the drag");
    // Escape right after the release (the motion may still be settling): the exit fade + blur still run.
    const closedAt = await trace.now();
    await page.keyboard.press("Escape");
    await page.waitForSelector("[data-slot=sheet-backdrop]", { state: "detached" });
    const samples = await trace.samples();
    const before = samples.filter((p) => !p.gone && p.t < closedAt);
    assert.ok(
      before.some((p) => p.blur > 0.5 && p.blur < 11.5 && p.opacity > 0 && p.opacity < 1),
      `blur between 0 and 12 px mid-fade in: ${JSON.stringify(before.slice(0, 4))}`,
    );
    const after = samples.filter((p) => !p.gone && p.t >= closedAt);
    assert.ok(
      after.some((p) => p.exiting && p.blur > 0.5 && p.blur < 11.5),
      `blur between 0 and 12 px mid-fade out: ${JSON.stringify(after.slice(0, 4))}`,
    );
    assert.deepEqual(seen.errors, []);
  }));
