// ScrollArea (Radix port) on a resumed page (story `/scroll-area`, production build, real Chromium): server markup
// (root / viewport / content, natively scrolling viewport, `type="always"` scrollbars, no thumbs before measuring, hidden
// native scrollbars), then `auto` / `always` areas activate when visible (scrollbars enable their axes, thumbs measure)
// and scrolling moves the thumb; thumb drag, track click, wheel over a scrollbar, hover / scroll / auto visibility, RTL,
// content resize. Story `/scroll-area-cold` (`hover` / `scroll` only): no scroll-area code runs before the pointer
// enters, a scroll or a focus reaches an area (its chunks are preloaded when visible); the activating event is not lost.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { among, codeOf, stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const open = async () => {
  const page = await s.browser.newPage({ viewport: { width: 900, height: 1600 } });
  const seen = watch(page);
  await page.goto(s.origin + "/scroll-area");
  return { page, seen };
};
const present = (page: Page, selector: string, value = true) =>
  page.waitForFunction(([selector, value]) => !!document.querySelector(selector as string) === value, [selector, value] as const);
const translate = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const m = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec((document.querySelector(selector) as HTMLElement | null)?.style.transform ?? "");
    return m ? [Number(m[1]), Number(m[2])] : null;
  }, selector);
const scrollTop = (page: Page, id: string) => page.evaluate((id) => document.getElementById(id)!.scrollTop, id);

test("server markup: root, viewport, content; always-scrollbars without thumbs; native scrollbars hidden", async () => {
  const html = await (await fetch(s.origin + "/scroll-area")).text();
  const root = /<div[^>]*id="always"[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(root, /dir="ltr"/);
  assert.match(root, /class="rv-ScrollArea"/);
  assert.match(root, /position:\s*relative/);
  assert.match(root, /--rv-scroll-area-corner-width:\s*0px/);
  const viewport = /<div[^>]*id="always-viewport"[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(viewport, /data-rv-scroll-area-viewport=""/);
  assert.match(viewport, /scrollbar-width:\s*none/);
  // before activation both axes scroll natively (the server cannot know which Scrollbars follow the Viewport)
  assert.match(viewport, /overflow-x:\s*scroll/);
  assert.match(viewport, /overflow-y:\s*scroll/);
  assert.match(html, /id="always-viewport"[^>]*>(<!--[^>]*-->)*<div[^>]*class="rv-ScrollAreaContent"[^>]*style="[^"]*display:\s*table/);
  const bar = /<div[^>]*id="always-y"[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(bar, /data-orientation="vertical"/);
  assert.match(bar, /data-state="visible"/);
  assert.match(bar, /position:\s*absolute/);
  assert.match(bar, /--rv-scroll-area-thumb-height:\s*18px/);
  assert.doesNotMatch(html, /id="always-thumb-y"/);
  assert.doesNotMatch(html, /id="always-corner"/);
  assert.doesNotMatch(html, /id="hover-y"|id="scroll-y"|id="auto-y"/);
  assert.match(html, /hover row 40/);
});

test("resumed: an area with no horizontal Scrollbar stops scrolling horizontally once active", async () => {
  const { page, seen } = await open();
  // `dynamic` has a vertical Scrollbar only (Radix: overflow-x hidden)
  await page.waitForFunction(() => (document.getElementById("dynamic-viewport") as HTMLElement).style.overflowX === "hidden");
  assert.equal(await page.evaluate(() => (document.getElementById("dynamic-viewport") as HTMLElement).style.overflowY), "scroll");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("resumed: with no interaction the scrollbars enable their axes and the thumbs measure; scrolling moves the thumb", async () => {
  const { page, seen } = await open();
  await page.waitForFunction(() => (document.getElementById("always-viewport") as HTMLElement).style.overflowY === "scroll");
  await present(page, "#always-thumb-y");
  await present(page, "#always-thumb-x");
  await present(page, "#always-corner");
  // viewport 200 (inner, minus the 1px borders: 198) over 1000 px of rows
  const ratio = await page.evaluate(() => {
    const vp = document.getElementById("always-viewport")!;
    return vp.offsetHeight / vp.scrollHeight;
  });
  const bar = (await page.locator("#always-y").boundingBox())!;
  const thumb = (await page.locator("#always-thumb-y").boundingBox())!;
  assert.ok(Math.abs(thumb.height - bar.height * ratio) < 1, `thumb ${thumb.height} ≈ ${bar.height} × ${ratio}`);
  // the corner sits between the two scrollbars
  const corner = (await page.locator("#always-corner").boundingBox())!;
  assert.equal(Math.round(corner.width), 10);
  assert.equal(Math.round(corner.height), 10);
  // wheel over the viewport (native scroll) → the thumb follows
  const vp = (await page.locator("#always-viewport").boundingBox())!;
  await page.mouse.move(vp.x + 50, vp.y + 50);
  await page.mouse.wheel(0, 300);
  await page.waitForFunction(() => document.getElementById("always-viewport")!.scrollTop > 0);
  await page.waitForFunction(() => {
    const vp = document.getElementById("always-viewport")!;
    const bar = document.getElementById("always-y")!;
    const thumb = document.getElementById("always-thumb-y")!;
    const m = /translate3d\(0px, (-?[\d.]+)px/.exec(thumb.style.transform);
    const expected = (vp.scrollTop / (vp.scrollHeight - vp.offsetHeight)) * (bar.clientHeight - thumb.offsetHeight);
    return !!m && Math.abs(Number(m[1]) - expected) < 1;
  });
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("resumed: thumb drag and track click scroll the viewport", async () => {
  const { page, seen } = await open();
  await present(page, "#always-thumb-y");
  const thumb = (await page.locator("#always-thumb-y").boundingBox())!;
  const bar = (await page.locator("#always-y").boundingBox())!;
  await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + 5);
  await page.mouse.down();
  await page.mouse.move(thumb.x + thumb.width / 2, bar.y + bar.height + 50, { steps: 5 });
  await page.mouse.up();
  const max = await page.evaluate(() => {
    const vp = document.getElementById("always-viewport")!;
    return vp.scrollHeight - vp.offsetHeight;
  });
  await page.waitForFunction((max) => document.getElementById("always-viewport")!.scrollTop === max, max);
  // track click near the top: the thumb centre jumps to the pointer
  await page.mouse.click(bar.x + bar.width / 2, bar.y + 2);
  await page.waitForFunction(() => document.getElementById("always-viewport")!.scrollTop === 0);
  // wheel over the scrollbar scrolls the viewport
  await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2);
  await page.mouse.wheel(0, 120);
  await page.waitForFunction(() => document.getElementById("always-viewport")!.scrollTop > 0);
  assert.ok((await scrollTop(page, "always-viewport")) > 0);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test('resumed: type="hover" shows the scrollbars while the pointer is over the area', async () => {
  const { page, seen } = await open();
  await page.waitForFunction(() => (document.getElementById("hover-viewport") as HTMLElement).style.overflowY === "scroll");
  assert.equal(await page.locator("#hover-y").count(), 0);
  const area = (await page.locator("#hover").boundingBox())!;
  await page.mouse.move(area.x + 50, area.y + 50);
  await present(page, "#hover-y");
  await present(page, "#hover-thumb-y");
  assert.equal(await page.locator("#hover-y").getAttribute("data-state"), "visible");
  await page.mouse.move(area.x + area.width + 200, area.y + 50);
  // scrollHideDelay 200
  await present(page, "#hover-y", false);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test('resumed: type="scroll" shows a scrollbar while scrolling, hides it after scrollHideDelay', async () => {
  const { page, seen } = await open();
  await page.waitForFunction(() => (document.getElementById("scroll-viewport") as HTMLElement).style.overflowY === "scroll");
  assert.equal(await page.locator("#scroll-y").count(), 0);
  const area = (await page.locator("#scroll").boundingBox())!;
  await page.mouse.move(area.x + 50, area.y + 50);
  await page.mouse.wheel(0, 200);
  await present(page, "#scroll-y");
  // the horizontal one did not scroll
  assert.equal(await page.locator("#scroll-x").count(), 0);
  // no corner for type="scroll"
  assert.equal(await page.locator("#scroll-corner").count(), 0);
  await present(page, "#scroll-y", false);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test('resumed: type="auto" shows the scrollbars of the overflowing axes', async () => {
  const { page, seen } = await open();
  await present(page, "#auto-y");
  await present(page, "#auto-x");
  assert.equal(await page.locator("#auto-y").getAttribute("data-state"), "visible");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("resumed: RTL thumb starts at the right and follows a negative scrollLeft", async () => {
  const { page, seen } = await open();
  await present(page, "#rtl-thumb-x");
  const bar = (await page.locator("#rtl-x").boundingBox())!;
  const thumb = (await page.locator("#rtl-thumb-x").boundingBox())!;
  assert.ok(Math.abs(thumb.x + thumb.width - (bar.x + bar.width)) < 1, "thumb at the right edge");
  await page.evaluate(() => (document.getElementById("rtl-viewport")!.scrollLeft = -10000));
  await page.waitForFunction(() => {
    const bar = document.getElementById("rtl-x")!.getBoundingClientRect();
    const thumb = document.getElementById("rtl-thumb-x")!.getBoundingClientRect();
    return Math.abs(thumb.left - bar.left) < 1;
  });
  assert.ok(((await translate(page, "#rtl-thumb-x")) ?? [0])[0]! < 0);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("resumed: the thumb re-measures when the content grows", async () => {
  const { page, seen } = await open();
  await present(page, "#dynamic-thumb-y");
  const before = (await page.locator("#dynamic-thumb-y").boundingBox())!.height;
  await page.click("#more-rows");
  await page.waitForFunction((before) => document.getElementById("dynamic-thumb-y")!.getBoundingClientRect().height < before - 5, before);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

// Scroll-area / presence code: chunks holding their symbols + the shared code only they import (build manifest).
const scrollAreaScripts = (scripts: string[]) => among(scripts, codeOf(/^@rivetjs\/cdk\/(scroll-area|presence)\/|#ScrollArea\w*\$/));
const openCold = async () => {
  const page = await s.browser.newPage({ viewport: { width: 900, height: 1000 } });
  const seen = watch(page);
  await page.goto(s.origin + "/scroll-area-cold");
  await page.waitForLoadState("networkidle");
  // idle boot, visible / idle preloads
  await page.waitForTimeout(1000);
  return { page, seen };
};

test("cold: hover / scroll areas run no code before interaction (chunks preloaded when visible); the viewport scrolls natively", async () => {
  const { page, seen } = await openCold();
  // `preload="visible"` activators: fetched + evaluated when the area is in view, nothing runs (no boot, no style).
  assert.equal(await page.locator("script[data-boot]").count(), 0, "nothing boots at load");
  assert.ok(scrollAreaScripts(seen.scripts).length > 0, "activator chunks preloaded when visible: " + seen.scripts.join(","));
  assert.equal(await page.locator("style[data-rv-scroll-area-style]").count(), 0, "no scroll-area code ran");
  const html = await page.content();
  assert.doesNotMatch(html, /id="hover-y"|id="scroll-y"|id="hover-corner"/);
  const viewport = await page.evaluate(() => {
    const vp = document.getElementById("hover-viewport")!;
    return { x: getComputedStyle(vp).overflowX, y: getComputedStyle(vp).overflowY, scrollbar: vp.offsetWidth - vp.clientWidth };
  });
  assert.deepEqual(viewport, { x: "scroll", y: "scroll", scrollbar: 0 });
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("cold: the first pointerenter loads the area and shows the hover scrollbars at once", async () => {
  const { page, seen } = await openCold();
  const area = (await page.locator("#hover").boundingBox())!;
  const before = seen.scripts.length;
  await page.mouse.move(area.x + 50, area.y + 50);
  await present(page, "#hover-y");
  await present(page, "#hover-thumb-y");
  await present(page, "#hover-corner");
  assert.equal(await page.locator("#hover-y").getAttribute("data-state"), "visible");
  // slow network (150 ms RTT, 4x CPU): first hover → thumb 1.47 s with interaction-only chunks, 0.12 s preloaded
  assert.deepEqual(scrollAreaScripts(seen.scripts.slice(before)), [], "the first hover needs no further scroll-area chunk");
  // the thumb follows a wheel scroll
  await page.mouse.wheel(0, 300);
  await page.waitForFunction(() => /translate3d\(0px, [1-9]/.test(document.getElementById("hover-thumb-y")!.style.transform));
  // the cold scroll area (pointer never entered) stays inactive-looking
  assert.equal(await page.locator("#scroll-y").count(), 0);
  await page.mouse.move(area.x + area.width + 200, area.y + 50);
  await present(page, "#hover-y", false);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test('cold: a scroll with no pointer activates a type="scroll" area and shows the scrolled axis', async () => {
  const { page, seen } = await openCold();
  await page.evaluate(() => (document.getElementById("scroll-viewport")!.scrollTop = 150));
  await present(page, "#scroll-y");
  assert.equal(await page.locator("#scroll-x").count(), 0);
  await present(page, "#scroll-thumb-y");
  // scrollHideDelay 200 after the scroll end
  await present(page, "#scroll-y", false);
  assert.equal(await scrollTop(page, "scroll-viewport"), 150);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("cold: keyboard focus activates an area (no scrollbar shown while not hovered)", async () => {
  const { page, seen } = await openCold();
  await page.focus("#hover-viewport");
  await page.waitForFunction(() => !!document.querySelector("style[data-rv-scroll-area-style]"));
  assert.ok(scrollAreaScripts(seen.scripts).length > 0);
  assert.equal(await page.locator("#hover-y").count(), 0);
  await page.keyboard.press("PageDown");
  await page.waitForFunction(() => document.getElementById("hover-viewport")!.scrollTop > 0);
  assert.deepEqual(seen.errors, []);
  await page.close();
});
