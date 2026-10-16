// Port of HeroUI v3.2.6 `packages/react/tests/components/scroll-shadow/scroll-shadow.browser.test.tsx` (Apache-2.0, © 2025 NextUI
// Inc.; modified): the scroll-driven fade of the vendored CSS (`data-scroll-shadow-mode=auto` → `--scroll-shadow-start-fade` /
// `-end-fade` from the scroll timeline, offset hold-back, no fade when the content fits, no-op mask kept, scroll-driven gradient
// wins over the attribute fallback), style variables, horizontal orientation (LTR 90deg / RTL 270deg), disabled detection (no mask),
// controlled visibility (attribute-driven mask). Rivet: Playwright Chromium against the resumed story page `/scroll-shadow-browser`
// (one instance per upstream fixture, fresh page per case) instead of `@heroui/testing/browser` `render`; `expect.poll` →
// `waitForFunction`; groups needing scroll timelines skip when `CSS.supports("animation-timeline", "scroll(self)")` is false; the
// RTL fixture also sets `lang="ar"` (Tailwind v4's production optimizer lowers `:dir(rtl)` to `:lang(…)` for Chrome 111 targets).
import { test, afterAll, beforeAll, describe } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

const SHADOW_SIZE = 40;
const VIEWPORT = 240;

let s: Stories;
let supportsScrollTimelines = true;
beforeAll(async () => {
  s = await stories();
  const page = await s.browser.newPage();
  supportsScrollTimelines = await page.evaluate(() => CSS.supports("animation-timeline", "scroll(self)"));
  await page.close();
});
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage();
  try {
    const seen = watch(page);
    await page.goto(s.origin + "/scroll-shadow-browser");
    await body(page);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
}

/** Scroll-timeline cases: skipped (visibly) on an engine without scroll timelines. */
const timeline = (name: string, body: (page: Page) => Promise<void>) =>
  test(name, async (ctx) => {
    if (!supportsScrollTimelines) return ctx.skip();
    await onPage(body);
  });

/** Lets the compositor apply the scroll-driven animation before styles are read. */
const nextFrames = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

const fadesOf = (page: Page, sel: string) =>
  page.$eval(sel, (el) => {
    const computed = getComputedStyle(el);
    return { start: computed.getPropertyValue("--scroll-shadow-start-fade").trim(), end: computed.getPropertyValue("--scroll-shadow-end-fade").trim() };
  });

/** `expect.poll(() => fadesOf(el)).toEqual(want)`. */
const pollFades = (page: Page, sel: string, want: { start: string; end: string }) =>
  page.waitForFunction(
    ([s, w]) => {
      const computed = getComputedStyle(document.querySelector(s!)!);
      return (
        JSON.stringify({
          start: computed.getPropertyValue("--scroll-shadow-start-fade").trim(),
          end: computed.getPropertyValue("--scroll-shadow-end-fade").trim(),
        }) === w
      );
    },
    [sel, JSON.stringify(want)] as const,
  );

/** Interpolated lengths land on device pixels, so compare them numerically. */
const startFadePxOf = (page: Page, sel: string) =>
  page.$eval(sel, (el) => Number.parseFloat(getComputedStyle(el).getPropertyValue("--scroll-shadow-start-fade")));

/** `expect.poll(() => startFadePxOf(el)).toBeCloseTo(want, 0)` (|Δ| < 0.5). */
const pollStartFadeClose = (page: Page, sel: string, want: number) =>
  page.waitForFunction(
    ([s, w]) => Math.abs(Number.parseFloat(getComputedStyle(document.querySelector(s!)!).getPropertyValue("--scroll-shadow-start-fade")) - w!) < 0.5,
    [sel, want] as const,
  );

const setScrollTop = (page: Page, sel: string, top: number | "max") =>
  page.$eval(sel, (el, t) => void (el.scrollTop = t === "max" ? el.scrollHeight - el.clientHeight : t), top);
const setScrollLeft = (page: Page, sel: string, left: "max") =>
  page.$eval(sel, (el, l) => void (el.scrollLeft = l === "max" ? el.scrollWidth - el.clientWidth : 0), left);
const maskImage = (page: Page, sel: string) => page.$eval(sel, (el) => getComputedStyle(el).maskImage);

describe("ScrollShadow (browser)", () => {
  describe("scroll-driven fade", () => {
    timeline("fades only the end edge while resting at the start", async (page) => {
      await pollFades(page, "#sb-over", { start: "0px", end: `${SHADOW_SIZE}px` });
    });

    timeline("fades both edges once scrolled into the middle", async (page) => {
      await setScrollTop(page, "#sb-over", 400);
      await pollFades(page, "#sb-over", { start: `${SHADOW_SIZE}px`, end: `${SHADOW_SIZE}px` });
    });

    timeline("fades only the start edge at the end of the scroll range", async (page) => {
      await setScrollTop(page, "#sb-over", "max");
      await pollFades(page, "#sb-over", { start: `${SHADOW_SIZE}px`, end: "0px" });
    });

    timeline("scrubs the start fade in across the shadow size", async (page) => {
      await setScrollTop(page, "#sb-over", SHADOW_SIZE / 2);
      await pollStartFadeClose(page, "#sb-over", SHADOW_SIZE / 2);
    });

    timeline("holds the start fade back until the offset is passed", async (page) => {
      await setScrollTop(page, "#sb-offset", 80);
      await nextFrames(page);
      assert.equal(await startFadePxOf(page, "#sb-offset"), 0);
      await setScrollTop(page, "#sb-offset", 80 + SHADOW_SIZE / 2);
      await pollStartFadeClose(page, "#sb-offset", SHADOW_SIZE / 2);
    });

    // A container without overflow has an inactive timeline, which has to hold both fades
    // at 0px rather than fade content that fits.
    timeline("renders no fade when the content fits", async (page) => {
      await nextFrames(page);
      assert.deepEqual(await fadesOf(page, "#sb-fit"), { start: "0px", end: "0px" });
    });

    // Deriving the mask from CSS alone means auto mode resolves a `mask-image` even with
    // nothing to scroll, so the root is always a stacking context. That is the deliberate
    // cost of not measuring overflow; the fade itself still collapses to a no-op.
    timeline("keeps a no-op mask rather than dropping it when the content fits", async (page) => {
      await nextFrames(page);
      assert.match(await maskImage(page, "#sb-fit"), /linear-gradient/);
    });

    // The hook still writes the state attributes, so the attribute rules match too. The
    // scroll-driven rules have to win the cascade, including the prefixed properties.
    timeline("resolves the mask from the scroll-driven gradient, not the attribute fallback", async (page) => {
      await page.waitForFunction(() => document.querySelector("#sb-over")?.getAttribute("data-bottom-scroll") === "true");
      const { mask, webkit } = await page.$eval("#sb-over", (el) => {
        const computed = getComputedStyle(el);
        return { mask: computed.maskImage, webkit: computed.webkitMaskImage };
      });
      // The scroll-driven gradient opens with a transparent stop; the fallback opens with black.
      assert.match(mask, /^linear-gradient\(rgba\(0, 0, 0, 0\)/);
      assert.match(webkit, /^linear-gradient\(rgba\(0, 0, 0, 0\)/);
    });
  });

  test("keeps the shadow size and offset when a style prop is supplied", () =>
    onPage(async (page) => {
      const v = await page.$eval("#sb-offset", (el) => {
        const computed = getComputedStyle(el);
        return {
          size: computed.getPropertyValue("--scroll-shadow-size").trim(),
          offset: computed.getPropertyValue("--scroll-shadow-offset").trim(),
          height: computed.height,
        };
      });
      assert.deepEqual(v, { size: `${SHADOW_SIZE}px`, offset: "80px", height: `${VIEWPORT}px` });
    }));

  // The inline axis drives Tabs' scroller, which is the common non-overflowing case.
  describe("horizontal orientation", () => {
    timeline("fades only the end edge while resting at the start", async (page) => {
      await pollFades(page, "#sb-row", { start: "0px", end: `${SHADOW_SIZE}px` });
    });

    timeline("fades only the start edge at the end of the scroll range", async (page) => {
      await setScrollLeft(page, "#sb-row", "max");
      await pollFades(page, "#sb-row", { start: `${SHADOW_SIZE}px`, end: "0px" });
    });

    timeline("renders no fade when the content fits", async (page) => {
      await nextFrames(page);
      assert.deepEqual(await fadesOf(page, "#sb-row-fit"), { start: "0px", end: "0px" });
    });

    // Inline-axis progress runs right-to-left in RTL, so the physical gradient has to flip
    // or the start fade would be painted on the wrong edge.
    timeline("points the gradient at the left edge in LTR", async (page) => {
      await nextFrames(page);
      assert.match(await maskImage(page, "#sb-row-ltr"), /90deg/);
    });

    timeline("flips the gradient to the right edge in RTL", async (page) => {
      await nextFrames(page);
      assert.match(await maskImage(page, "#sb-row-rtl"), /270deg/);
    });

    timeline("still fades only the end edge while resting at the start in RTL", async (page) => {
      await pollFades(page, "#sb-row-rtl", { start: "0px", end: `${SHADOW_SIZE}px` });
    });
  });

  describe("disabled detection", () => {
    test("renders no fade when detection is turned off", () =>
      onPage(async (page) => {
        assert.equal(await page.getAttribute("#sb-off", "data-scroll-shadow-mode"), "manual");
        await nextFrames(page);
        assert.equal(await maskImage(page, "#sb-off"), "none");
      }));
  });

  describe("controlled visibility", () => {
    test("keeps using the attribute-driven mask", () =>
      onPage(async (page) => {
        assert.equal(await page.getAttribute("#sb-both", "data-scroll-shadow-mode"), "manual");
        // The controlled attribute is written by a client effect on the resumed page (upstream: synchronously in a layout effect).
        await page.waitForFunction(() => document.querySelector("#sb-both")?.getAttribute("data-top-bottom-scroll") === "true");
        // The fallback gradient opens with black; the scroll-driven one opens transparent.
        assert.match(await maskImage(page, "#sb-both"), /^linear-gradient\(rgb\(0, 0, 0\)/);
      }));
  });
});
