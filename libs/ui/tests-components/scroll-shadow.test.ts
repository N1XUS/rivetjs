// ScrollShadow — resumed story app (`/scroll-shadow`): SSR markup (classes, auto mode, size variables, no scroll-state attributes),
// HeroUI CSS applied (overflow, mask); after resume the hook writes `data-top-scroll` / `data-bottom-scroll` with no user event
// and follows the scroll edges (+ `onVisibilityChange` → output); live `orientation` keeps the same container and its scroll
// position; live `size` / `hideScrollBar` / `visibility` (controlled attributes, manual mode) / `isEnabled` update in place.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage();
  try {
    await body(page);
  } finally {
    await page.close();
  }
}

const mark = (page: Page, selector: string) => page.$eval(selector, (el) => void ((el as unknown as Record<string, boolean>).__rvMark = true));
const marked = (page: Page, selector: string) => page.$eval(selector, (el) => (el as unknown as Record<string, boolean>).__rvMark === true);
const attr = (page: Page, selector: string, name: string) => page.getAttribute(selector, name);
const waitAttr = (page: Page, selector: string, name: string, value: string | null) =>
  page.waitForFunction(([sel, n, v]) => document.querySelector(sel!)?.getAttribute(n!) === v, [selector, name, value] as const);
const setScroll = (page: Page, top: number | null, left: number | null) =>
  page.$eval(
    "#ss",
    (el, [t, l]) => {
      if (t !== null) el.scrollTop = t === -1 ? el.scrollHeight : t;
      if (l !== null) el.scrollLeft = l === -1 ? el.scrollWidth : l;
    },
    [top, left] as const,
  );
const scrollPos = (page: Page) => page.$eval("#ss", (el) => ({ top: el.scrollTop, left: el.scrollLeft }));

test("scroll-shadow: SSR markup — classes, auto mode, size variables, no scroll state; CSS applied", () =>
  onPage(async (page) => {
    const seen = watch(page);
    const response = await page.goto(s.origin + "/scroll-shadow");
    const html = (await response!.text()).match(/<div[^>]*id="ss"[^>]*>/)![0];
    assert.match(html, /class="scroll-shadow scroll-shadow--vertical scroll-shadow--fade"/);
    assert.match(html, /data-scroll-shadow-mode="auto"/);
    assert.match(html, /data-orientation="vertical"/);
    assert.match(html, /--scroll-shadow-size:\s?40px/);
    assert.doesNotMatch(html, /data-(top|bottom)-scroll/);
    assert.equal(await page.$eval("#ss", (el) => getComputedStyle(el).overflowY), "auto");
    assert.equal(await page.$eval("#ss", (el) => getComputedStyle(el).height), "120px");
    assert.equal(await attr(page, "#ss-static", "data-slot"), "scroll-shadow");
    await page.waitForLoadState("networkidle");
    assert.deepEqual(seen.errors, []);
  }));

test("scroll-shadow: after resume the scroll-state attributes follow the scroll edges (no user event needed)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/scroll-shadow");
    await waitAttr(page, "#ss", "data-bottom-scroll", "true");
    assert.equal(await attr(page, "#ss", "data-top-scroll"), "false");
    await page.waitForFunction(() => document.querySelector("#ss-state")?.textContent === "bottom");
    await mark(page, "#ss");
    await setScroll(page, 400, null);
    await waitAttr(page, "#ss", "data-top-bottom-scroll", "true");
    assert.equal(await attr(page, "#ss", "data-top-scroll"), null);
    await page.waitForFunction(() => document.querySelector("#ss-state")?.textContent === "both");
    await setScroll(page, -1, null);
    await waitAttr(page, "#ss", "data-top-scroll", "true");
    assert.equal(await attr(page, "#ss", "data-bottom-scroll"), "false");
    assert.equal(await attr(page, "#ss", "data-top-bottom-scroll"), null);
    await page.waitForFunction(() => document.querySelector("#ss-state")?.textContent === "top");
    await setScroll(page, 0, null);
    await waitAttr(page, "#ss", "data-top-scroll", "false");
    assert.equal(await attr(page, "#ss", "data-bottom-scroll"), "true");
    assert.ok(await marked(page, "#ss"), "container kept");
    assert.deepEqual(seen.errors, []);
  }));

test("scroll-shadow: live orientation keeps the container and its scroll position; horizontal edges after the change", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/scroll-shadow");
    await waitAttr(page, "#ss", "data-bottom-scroll", "true");
    await setScroll(page, 300, null);
    await waitAttr(page, "#ss", "data-top-bottom-scroll", "true");
    await mark(page, "#ss");
    await mark(page, "#ss-content");
    await page.click("#ss-orient");
    await waitAttr(page, "#ss", "data-orientation", "horizontal");
    assert.match((await attr(page, "#ss", "class")) ?? "", /scroll-shadow--horizontal/);
    assert.equal((await scrollPos(page)).top, 300, "scrollTop survives the orientation change");
    await waitAttr(page, "#ss", "data-right-scroll", "true");
    assert.equal(await attr(page, "#ss", "data-left-scroll"), "false");
    await setScroll(page, null, 200);
    await waitAttr(page, "#ss", "data-left-right-scroll", "true");
    await page.click("#ss-orient");
    await waitAttr(page, "#ss", "data-orientation", "vertical");
    assert.deepEqual(await scrollPos(page), { top: 300, left: 200 }, "both scroll offsets survive");
    await page.click("#ss-orient");
    await waitAttr(page, "#ss", "data-orientation", "horizontal");
    assert.deepEqual(await scrollPos(page), { top: 300, left: 200 });
    assert.ok(await marked(page, "#ss"), "container kept");
    assert.ok(await marked(page, "#ss-content"), "content kept");
    assert.deepEqual(seen.errors, []);
  }));

test("scroll-shadow: live size / hideScrollBar / visibility / isEnabled update the same container after resume", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/scroll-shadow");
    await waitAttr(page, "#ss", "data-bottom-scroll", "true");
    await mark(page, "#ss");
    await page.click("#ss-size");
    await waitAttr(page, "#ss", "data-scroll-shadow-size", "80");
    assert.equal(await page.$eval("#ss", (el) => (el as HTMLElement).style.getPropertyValue("--scroll-shadow-size")), "80px");
    await page.click("#ss-hide");
    await page.waitForFunction(() => /scroll-shadow--hide-scrollbar/.test(document.querySelector("#ss")!.className));
    await page.click("#ss-vis");
    await waitAttr(page, "#ss", "data-scroll-shadow-mode", "manual");
    await waitAttr(page, "#ss", "data-top-bottom-scroll", "true");
    assert.equal(await attr(page, "#ss", "data-bottom-scroll"), null);
    await page.click("#ss-vis");
    await waitAttr(page, "#ss", "data-top-bottom-scroll", null);
    assert.equal(await attr(page, "#ss", "data-top-scroll"), null);
    await page.click("#ss-vis");
    await waitAttr(page, "#ss", "data-scroll-shadow-mode", "auto");
    await waitAttr(page, "#ss", "data-bottom-scroll", "true");
    await page.click("#ss-enabled");
    await waitAttr(page, "#ss", "data-scroll-shadow-mode", "manual");
    await setScroll(page, 400, null);
    await page.waitForTimeout(100);
    assert.equal(await attr(page, "#ss", "data-top-bottom-scroll"), null, "disabled detection ignores scrolling");
    await page.click("#ss-enabled");
    await waitAttr(page, "#ss", "data-top-bottom-scroll", "true");
    assert.ok(await marked(page, "#ss"), "container kept");
    assert.deepEqual(seen.errors, []);
  }));
