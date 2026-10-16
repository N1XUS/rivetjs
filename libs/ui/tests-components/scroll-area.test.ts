// ScrollArea (Rivet addition) — resumed story app (`/scroll-area`): SSR classes + `data-slot` per part, vendored-format CSS
// applied (thumb radius / colour, sm width); no scroll-area code runs before interaction (hover areas, `always` area below
// the fold; chunks are preloaded when visible); pointer over `#sa-hover` shows the scrollbar + thumb (HeroUI look) and the wheel moves the thumb; the `always` area
// activates when scrolled into view (bars + corner); `shadow` = ScrollShadow classes / auto mode on the viewport.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage({ viewport: { width: 800, height: 600 } });
  try {
    await body(page);
  } finally {
    await page.close();
  }
}

const SCROLL_AREA_SCRIPT = /scroll-area|ScrollArea|presence/i;
const tag = (html: string, id: string) => new RegExp(`<div[^>]*id="${id}"[^>]*>`).exec(html)?.[0] ?? "";

test("scroll-area: SSR classes + data-slot, shadow viewport, native overflow before activation", () =>
  onPage(async (page) => {
    const response = await page.goto(s.origin + "/scroll-area");
    const html = await response!.text();
    const root = tag(html, "sa-hover");
    assert.match(root, /class="scroll-area scroll-area--md scroll-area--hover"/);
    assert.match(root, /data-slot="scroll-area"/);
    const vp = tag(html, "sa-hover-viewport");
    assert.match(vp, /class="scroll-area__viewport"/);
    assert.match(vp, /data-slot="scroll-area-viewport"/);
    assert.match(vp, /overflow-y:\s?scroll/);
    assert.doesNotMatch(html, /id="sa-hover-y"/); // hover type: no scrollbar until the pointer enters
    assert.match(tag(html, "sa-always"), /class="scroll-area scroll-area--sm scroll-area--always"/);
    // always: static scrollbar placeholders in the server HTML (first frame already shows the tracks)
    assert.match(tag(html, "sa-always-y"), /class="scroll-area__scrollbar"[^>]*|data-slot="scroll-area-scrollbar"/);
    assert.match(tag(html, "sa-always-y"), /data-state="visible"/);
    const shadow = tag(html, "sa-shadow-viewport");
    assert.match(shadow, /class="scroll-area__viewport scroll-shadow scroll-shadow--hide-scrollbar scroll-shadow--vertical scroll-shadow--fade"/);
    assert.match(shadow, /data-scroll-shadow-mode="auto"/);
    assert.match(shadow, /--scroll-shadow-size:\s?40px/);
    assert.equal(await page.$eval("#sa-hover", (el) => getComputedStyle(el).overflow), "hidden");
    assert.equal(await page.$eval("#sa-always-y", (el) => getComputedStyle(el).width), "6px");
  }));

test("scroll-area: no scroll-area code runs before interaction (chunks preloaded when visible); hover shows the HeroUI scrollbar and the wheel moves the thumb", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/scroll-area");
    await page.waitForLoadState("networkidle");
    // cdk activators are `preload="visible"`: fetched when in view, nothing runs (no boot, no scroll-area style yet).
    assert.equal(await page.locator("style[data-rv-scroll-area-style]").count(), 0, "no scroll-area code ran");
    assert.ok(
      seen.scripts.some((u) => SCROLL_AREA_SCRIPT.test(u)),
      "scroll-area chunks preloaded when visible",
    );
    const loaded = seen.scripts.length;
    await page.hover("#sa-hover-viewport");
    await page.waitForSelector("#sa-hover-thumb", { state: "attached" });
    assert.deepEqual(
      seen.scripts.slice(loaded).filter((u) => SCROLL_AREA_SCRIPT.test(u)),
      [],
      "the first hover needs no further scroll-area chunk",
    );
    await page.waitForFunction(() => document.querySelector("#sa-hover-y")?.getAttribute("data-state") === "visible");
    assert.equal(await page.getAttribute("#sa-hover-y", "data-slot"), "scroll-area-scrollbar");
    assert.equal(await page.getAttribute("#sa-hover-thumb", "class"), "scroll-area__thumb");
    const thumb = await page.$eval("#sa-hover-thumb", (el) => {
      const cs = getComputedStyle(el);
      return { radius: parseFloat(cs.borderTopLeftRadius), bg: cs.backgroundColor, width: el.getBoundingClientRect().width };
    });
    assert.ok(thumb.radius >= 3, `rounded thumb (${thumb.radius})`);
    assert.notEqual(thumb.bg, "rgba(0, 0, 0, 0)");
    assert.ok(thumb.width > 0 && thumb.width <= 10, `thin thumb (${thumb.width})`);
    const before = await page.$eval("#sa-hover-thumb", (el) => el.getBoundingClientRect().top);
    await page.mouse.wheel(0, 200);
    await page.waitForFunction((t) => document.querySelector("#sa-hover-thumb")!.getBoundingClientRect().top > t + 5, before);
    assert.equal(await page.$eval("#sa-hover-viewport", (el) => getComputedStyle(el).overflowX), "hidden");
    assert.deepEqual(seen.errors, []);
  }));

test("scroll-area: variant=always activates when scrolled into view (bars, thumbs, corner)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/scroll-area");
    await page.waitForLoadState("networkidle");
    await page.$eval("#sa-always", (el) => el.scrollIntoView());
    await page.waitForSelector("#sa-always-y .scroll-area__thumb", { state: "attached" });
    await page.waitForSelector("#sa-always-x .scroll-area__thumb", { state: "attached" });
    await page.waitForSelector("#sa-always-corner", { state: "attached" });
    assert.equal(await page.getAttribute("#sa-always-corner", "data-slot"), "scroll-area-corner");
    assert.equal(await page.getAttribute("#sa-always-x", "data-state"), "visible");
    assert.equal(await page.$eval("#sa-always-x", (el) => getComputedStyle(el).height), "6px");
    assert.deepEqual(seen.errors, []);
  }));
