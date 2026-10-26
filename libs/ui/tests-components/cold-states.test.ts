// Cold visual states + touch press cancel (ZERO ONDEMAND, ruling R-14 conditions applied to buttons WITH handlers) —
// resumed story app `/cold-states` (lean: no JS before the first interaction). The page's JS is held at the network until
// the test releases it, so the "cold" shot is the page before any ui / cdk code ran (CSS `:hover` / `:active` /
// `:focus-visible`), the "warm" shot the same pointer / focus after the adopt run (`data-hovered` / `data-pressed` /
// `data-focus-visible`): pixel parity for Button, CloseButton and a PromptSuggestion item (hover / focus only: its press
// scale has no `:active` twin: measured slower first adopt, `libs/ui/styles/TWEAKS.md` TW-155). Touch: a press that turns into a
// scroll is cancelled the same whether the code arrives during the gesture, after it, or was there before: no `onPress`,
// no stuck `data-pressed`, no stuck `:active` scale.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import sharp from "sharp";
import type { BrowserContext, Page } from "playwright";
import { stories, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const TARGETS = ["#cs-button", "#cs-close", "#cs-suggest"] as const;
/** Press looks the same cold only where the pressed style has an `:active` twin. */
const COLD_PRESS = new Set<string>(["#cs-button", "#cs-close"]);

/** Holds every script request until `release()` (the inline loader runs; nothing it imports does). */
async function hold(page: Page): Promise<() => void> {
  let release!: () => void;
  const open = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\.m?js(\?|$)/, async (route) => {
    await open;
    await route.continue();
  });
  return release;
}
async function withContext(options: Parameters<Stories["browser"]["newContext"]>[0], body: (context: BrowserContext) => Promise<void>): Promise<void> {
  const context = await s.browser.newContext({ reducedMotion: "reduce", viewport: { width: 640, height: 480 }, ...options });
  try {
    await body(context);
  } finally {
    await context.close();
  }
}
/** The element's box + 8 px (focus rings draw outside it). */
async function shot(page: Page, selector: string): Promise<Buffer> {
  const box = (await page.locator(selector).boundingBox())!;
  return page.screenshot({ clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 } });
}
async function same(a: Buffer, b: Buffer): Promise<string | null> {
  const [x, y] = await Promise.all([a, b].map((png) => sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  if (x.info.width !== y.info.width || x.info.height !== y.info.height) return `${x.info.width}x${x.info.height} vs ${y.info.width}x${y.info.height}`;
  let pixels = 0;
  for (let i = 0; i < x.data.length; i += 4)
    if (x.data[i] !== y.data[i] || x.data[i + 1] !== y.data[i + 1] || x.data[i + 2] !== y.data[i + 2] || x.data[i + 3] !== y.data[i + 3]) pixels++;
  return pixels ? `${pixels} px differ` : null;
}
const center = async (page: Page, selector: string) => {
  const box = (await page.locator(selector).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

for (const selector of TARGETS)
  test(`cold states ${selector}: hover / press / focus-visible look the same before and after the adopt run`, () =>
    withContext({}, async (context) => {
      const failures: string[] = [];
      const rest = await (async () => {
        const page = await context.newPage();
        await page.goto(s.origin + "/cold-states");
        const png = await shot(page, selector);
        await page.close();
        return png;
      })();
      for (const state of ["hover", "press", "focus"] as const) {
        const page = await context.newPage();
        const release = await hold(page);
        await page.goto(s.origin + "/cold-states");
        const at = await center(page, selector);
        if (state === "focus") {
          await page.focus("body");
          while (!(await page.evaluate((sel) => document.activeElement?.matches(sel), selector))) await page.keyboard.press("Tab");
        } else {
          await page.mouse.move(at.x, at.y);
          if (state === "press") await page.mouse.down();
        }
        await page.waitForTimeout(200);
        const cold = await shot(page, selector);
        assert.equal(
          await page.$eval(selector, (el) => el.getAttribute("data-hovered") ?? el.getAttribute("data-pressed") ?? el.getAttribute("data-focus-visible")),
          null,
          "cold: no ui JS ran",
        );
        release();
        const attr = { hover: "data-hovered", press: "data-pressed", focus: "data-focus-visible" }[state];
        await page.waitForSelector(`${selector}[${attr}="true"]`);
        await page.waitForTimeout(100);
        const warm = await shot(page, selector);
        if (state !== "press" || COLD_PRESS.has(selector)) {
          const diff = await same(cold, warm);
          if (diff) failures.push(`${state}: ${diff}`);
          if (!(await same(rest, cold))) failures.push(`${state}: the cold shot shows no state (same as at rest)`);
        }
        if (state === "press") {
          await page.mouse.up();
          const out = { "#cs-button": ["#cs-pressed", "1"], "#cs-close": ["#cs-closed", "1"], "#cs-suggest": ["#cs-picked", "trip"] }[selector];
          await page.waitForFunction(([sel, text]) => document.querySelector(sel!)?.textContent === text, out);
        }
        await page.close();
      }
      assert.deepEqual(failures, []);
    }));

/** A touch that starts on `selector` and drags 200 px up (the page scrolls: pointercancel). */
async function touchScroll(page: Page, selector: string, mid?: () => Promise<void>): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const { x, y } = await center(page, selector);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - i * 20 }] });
    if (i === 5) await mid?.();
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

for (const when of ["during", "after", "before"] as const)
  test(`touch press cancel: a press that scrolls fires nothing and leaves no pressed state (code ${when} the gesture)`, () =>
    withContext({ hasTouch: true, isMobile: true }, async (context) => {
      for (const selector of TARGETS) {
        const page = await context.newPage();
        const release = when === "before" ? () => {} : await hold(page);
        await page.goto(s.origin + "/cold-states");
        if (when === "before") {
          // Adopted first: a tap on the button's output text is no press; focusing the target through the keyboard
          // loads its code (intent).
          await page.focus(selector);
          await page.waitForLoadState("networkidle");
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await touchScroll(page, selector, when === "during" ? async () => release() : undefined);
        if (when === "after") release();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(300);
        assert.ok((await page.evaluate(() => scrollY)) > 0, `${selector}: the drag scrolled the page`);
        const state = await page.$eval(selector, (el) => {
          const style = getComputedStyle(el);
          // Identity (none, or the identity matrix a finished transition leaves): not the pressed scale.
          const flat = (value: string) => value === "none" || value === "matrix(1, 0, 0, 1, 0, 0)" || value === "1";
          return { pressed: el.getAttribute("data-pressed"), active: el.matches(":active"), unscaled: flat(style.transform) && flat(style.scale) };
        });
        assert.deepEqual(state, { pressed: null, active: false, unscaled: true }, `${selector} (${when}): no pressed state`);
        assert.deepEqual(
          await page.$$eval("#cs-pressed, #cs-closed, #cs-picked", (els) => els.map((el) => el.textContent)),
          ["0", "0", ""],
          `${selector} (${when}): no press fired`,
        );
        await page.close();
      }
    }));
