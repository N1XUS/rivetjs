// Sidebar resize handle (Rivet extension, `resizable`) — resumed story app (`/sidebar-resize`): SSR markup (separator
// ARIA, BEM class), no effect booted before interaction; a cold real-mouse drag resizes (live +
// committed callbacks, mid-drag divider highlight, `data-resizing` drops the gap transition); min / max clamp; dragging
// below half the minimum collapses to the icon rail (house motion) and back; keyboard (arrows, Shift, Home / End,
// Enter toggles); collapse writes the cookie; double-click resets to the provider width; RTL mirrors the drag; < 768 px no handle.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories, type Watch } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page, seen: Watch) => Promise<void>, width = 1280): Promise<void> {
  const context = await s.browser.newContext({ viewport: { width, height: 720 } });
  const page = await context.newPage();
  const seen = watch(page);
  try {
    await page.goto(s.origin + "/sidebar-resize");
    await page.waitForLoadState("networkidle");
    await body(page, seen);
    assert.deepEqual(seen.errors, []);
  } finally {
    await context.close();
  }
}

const HANDLE = '[data-slot="sidebar-resize-handle"]';
const gapWidth = (page: Page) => page.locator('[data-slot="sidebar-gap"]').evaluate((el) => Math.round(el.getBoundingClientRect().width));
const settled = (page: Page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
const text = (page: Page, sel: string) => page.locator(sel).textContent();

async function drag(page: Page, toX: number, opts: { hold?: (page: Page) => Promise<void> } = {}): Promise<void> {
  const h = (await page.locator(HANDLE).boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + 200);
  await page.mouse.down();
  await page.mouse.move(toX, h.y + 200, { steps: 6 });
  if (opts.hold) await opts.hold(page);
  await page.mouse.up();
}

test("sidebar-resize: SSR markup", async () => {
  const page = await s.browser.newPage();
  try {
    const html = await (await page.request.get(s.origin + "/sidebar-resize")).text();
    const tag = html.match(/<div[^>]*data-slot="sidebar-resize-handle"[^>]*>/)?.[0] ?? "";
    assert.match(tag, /role="separator"/);
    assert.match(tag, /aria-orientation="vertical"/);
    assert.match(tag, /aria-valuemin="200"/);
    assert.match(tag, /aria-valuemax="400"/);
    assert.match(tag, /tabindex="0"/);
    assert.match(tag, /class="[^"]*sidebar__resize-handle/);
    assert.match(tag, /aria-label="Resize sidebar"/);
  } finally {
    await page.close();
  }
});

test("sidebar-resize: cold mouse drag resizes; live + committed callbacks; mid-drag marks", () =>
  onPage(async (page) => {
    assert.equal(await gapWidth(page), 256);
    // Handler chunks are preloaded while visible (sidebar wrapper `preload="visible"`), but nothing runs before input.
    assert.equal(await page.locator("[data-boot]").count(), 0, "no effect booted before interaction");
    let mid: { dragging: string | null; resizing: string | null; line: string } | null = null;
    await drag(page, 330, {
      hold: async (p) => {
        mid = await p.locator(HANDLE).evaluate((el) => ({
          dragging: el.getAttribute("data-dragging"),
          resizing: el.closest('[data-slot="sidebar"]')!.getAttribute("data-resizing"),
          line: getComputedStyle(el, "::after").backgroundColor,
        }));
      },
    });
    assert.equal(mid!.dragging, "true");
    assert.equal(mid!.resizing, "true");
    assert.notEqual(mid!.line, "rgba(0, 0, 0, 0)", "divider highlighted mid-drag");
    const w = await gapWidth(page);
    assert.ok(Math.abs(w - 330) <= 3, `dragged to 330: ${w}`);
    assert.equal(await page.locator(HANDLE).getAttribute("aria-valuenow"), String(w));
    assert.equal(await text(page, "#sr-end"), String(w));
    assert.equal(await text(page, "#sr-width"), String(w));
    assert.equal(await page.locator(HANDLE).getAttribute("data-dragging"), null);
    assert.equal(await page.locator('[data-slot="sidebar"]').getAttribute("data-resizing"), null);
  }));

for (const input of ["mouse", "touch"] as const)
  test(`sidebar-resize: a complete cold ${input} drag survives code arriving after release`, async () => {
    const context = await s.browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: input === "touch" });
    const page = await context.newPage();
    const seen = watch(page);
    let release!: () => void;
    const code = new Promise<void>((resolve) => (release = resolve));
    await page.route(/\.m?js(\?|$)/, async (route) => {
      await code;
      await route.continue();
    });
    try {
      await page.goto(s.origin + "/sidebar-resize", { waitUntil: "domcontentloaded" });
      if (input === "mouse") await drag(page, 330);
      else {
        const h = (await page.locator(HANDLE).boundingBox())!;
        const x = h.x + h.width / 2;
        const y = h.y + 200;
        const cdp = await context.newCDPSession(page);
        try {
          await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
          for (let step = 1; step <= 6; step++)
            await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + ((330 - x) * step) / 6, y }] });
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        } finally {
          await cdp.detach();
        }
      }
      assert.equal(await text(page, "#sr-width"), "", "the entire physical gesture finished before the handlers loaded");
      assert.equal(await text(page, "#sr-end"), "");
      release();
      await page.waitForFunction(() => Boolean(document.querySelector("#sr-end")?.textContent), undefined, { timeout: 5000 });
      const committed = await text(page, "#sr-end");
      assert.ok(Math.abs(Number(committed) - 330) <= 3, `${input} committed drag to 330: ${committed}`);
      assert.equal(await text(page, "#sr-width"), committed);
      // All queued moves and release can replay in one task: removing data-resizing then starts the gap's CSS transition.
      await page.waitForFunction(
        (value) => Math.round(document.querySelector('[data-slot="sidebar-gap"]')!.getBoundingClientRect().width) === value,
        Number(committed),
      );
      const width = await gapWidth(page);
      assert.equal(String(width), committed);
      assert.equal(await page.locator(HANDLE).getAttribute("data-dragging"), null);
      assert.equal(await page.locator('[data-slot="sidebar"]').getAttribute("data-resizing"), null);
      assert.deepEqual(seen.errors, []);
    } finally {
      release();
      await context.close();
    }
  });

test("sidebar-resize: min / max clamp", () =>
  onPage(async (page) => {
    await drag(page, 900);
    assert.equal(await gapWidth(page), 400);
    await drag(page, 150);
    assert.equal(await gapWidth(page), 200);
    assert.equal(await page.locator('[data-slot="sidebar"]').getAttribute("data-state"), "expanded");
  }));

test("sidebar-resize: below half the minimum collapses to the icon rail, dragging out re-opens", () =>
  onPage(async (page) => {
    await drag(page, 40);
    await settled(page);
    const root = page.locator('[data-slot="sidebar"]');
    assert.equal(await root.getAttribute("data-state"), "collapsed");
    assert.equal(await root.getAttribute("data-collapsible"), "icon");
    assert.equal(await gapWidth(page), 48);
    assert.equal(await text(page, "#sr-log"), "c");
    assert.match(await page.evaluate(() => document.cookie), /sidebar_state=false/);
    await drag(page, 260);
    await settled(page);
    assert.equal(await root.getAttribute("data-state"), "expanded");
    assert.ok(Math.abs((await gapWidth(page)) - 260) <= 3);
    assert.equal(await text(page, "#sr-log"), "co");
  }));

test("sidebar-resize: keyboard — arrows, Shift, Home / End, Enter toggles", () =>
  onPage(async (page) => {
    await page.locator(HANDLE).focus();
    // The first key is cold (held by the loader, replayed once the handle's chunk loaded): wait on the state, not the press.
    // (Uncontrolled width: the server writes no `aria-valuenow` until the first change.)
    const nowIs = (value: string) =>
      page.waitForFunction(([sel, v]) => document.querySelector(sel)?.getAttribute("aria-valuenow") === v, [HANDLE, value] as const);
    const stateIs = (state: string) => page.waitForFunction((v) => document.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state") === v, state);
    await page.keyboard.press("ArrowRight");
    await nowIs("272");
    await page.keyboard.press("Shift+ArrowLeft");
    await nowIs("200");
    await page.keyboard.press("End");
    await nowIs("400");
    await settled(page);
    assert.equal(await gapWidth(page), 400);
    await page.keyboard.press("Home");
    await nowIs("200");
    assert.equal(await text(page, "#sr-end"), "200");
    await page.keyboard.press("Enter");
    await stateIs("collapsed");
    await settled(page);
    await page.keyboard.press("Enter");
    await stateIs("expanded");
    await settled(page);
    assert.equal(await gapWidth(page), 200);
    const focusVisible = await page.locator(HANDLE).evaluate((el) => el.matches(":focus-visible"));
    assert.ok(focusVisible);
  }));

test("sidebar-resize: double-click resets to the provider width", () =>
  onPage(async (page) => {
    await drag(page, 380);
    assert.ok((await gapWidth(page)) > 370);
    await page.locator(HANDLE).dblclick();
    await settled(page);
    assert.equal(await gapWidth(page), 256);
  }));

test("sidebar-resize: RTL mirrors the drag", () =>
  onPage(async (page) => {
    await page.evaluate(() => (document.documentElement.dir = "rtl"));
    const before = (await page.locator('[data-slot="sidebar-container"]').boundingBox())!;
    assert.ok(before.x + before.width >= 1279, "panel on the right in RTL");
    await drag(page, 1280 - 320);
    const w = await gapWidth(page);
    assert.ok(Math.abs(w - 320) <= 3, `RTL drag to 320: ${w}`);
  }));

test("sidebar-resize: below 768 px the panel is a sheet, no handle shown", () =>
  onPage(async (page) => {
    assert.equal(await page.locator(HANDLE).isVisible(), false);
  }, 600));
