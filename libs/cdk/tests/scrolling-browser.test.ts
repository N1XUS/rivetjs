// <CdkVirtualScrollViewport> in the resumed story app: server-rendered first range, zero library JS
// before interaction, keyed row reuse across scrolls, scrollToIndex, data changes, RTL / horizontal,
// autosize in a <ul>, appendOnly, ancestor-element and window scrolling.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, libraryScripts, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const texts = (page: import("playwright").Page, sel: string) => page.$$eval(sel, (els) => els.map((el) => el.textContent!.trim()));
const settle = (page: import("playwright").Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60))));

test("viewport: server range, no library JS before scroll, scroll renders the window with keyed reuse", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/scrolling");
  assert.deepEqual(await texts(page, "#fixed .row"), ["Item 0", "Item 1", "Item 2", "Item 3", "Item 4", "Item 5", "Item 6", "Item 7"], "200px + 200px buffer at 50px");
  assert.equal(await page.$eval("#fixed .cdk-virtual-scroll-spacer", (el) => (el as HTMLElement).style.height), "500000px");
  assert.equal(await page.getAttribute("#fixed", "class"), "cdk-virtual-scroll-viewport cdk-virtual-scrollable cdk-virtual-scroll-orientation-vertical vp");
  assert.deepEqual(libraryScripts(seen), [], "no library code before interaction");
  // Scroll: the engine wakes, renders rows 98.. and translates the wrapper.
  await page.$eval("#fixed", (el) => (el.scrollTop = 5000));
  await page.waitForFunction(() => document.querySelector("#fixed .row")?.textContent?.trim() === "Item 98");
  assert.equal(await page.$eval("#fixed .cdk-virtual-scroll-content-wrapper", (el) => (el as HTMLElement).style.transform), "translateY(4900px)");
  await page.waitForFunction(() => document.querySelector("#fixed-index")?.textContent === "100");
  // Keyed reuse: a row that stays in range keeps its DOM node.
  await page.evaluate(() => ((window as unknown as { kept: Element }).kept = [...document.querySelectorAll("#fixed .row")].find((el) => el.textContent!.trim() === "Item 105")!));
  await page.$eval("#fixed", (el) => (el.scrollTop = 5150));
  await settle(page);
  assert.ok(await page.evaluate(() => (window as unknown as { kept: Element }).kept.isConnected), "row node reused");
  const rows = await texts(page, "#fixed .row");
  assert.ok(rows.length <= 12, `only the window is in the DOM (${rows.length})`);
  // Context accessors: absolute index / odd.
  assert.equal(await page.$eval("#fixed .row", (el) => el.getAttribute("data-index")), rows[0]!.replace("Item ", ""));
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("viewport: scrollToIndex / scrollToOffset buttons, data shrink keeps a valid range", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/scrolling");
  await page.click("#to-500");
  await page.waitForFunction(() => document.querySelector("#fixed")!.scrollTop === 25000);
  await page.waitForFunction(() => [...document.querySelectorAll("#fixed .row")].some((el) => el.textContent!.trim() === "Item 500"));
  await page.click("#to-offset");
  await page.waitForFunction(() => document.querySelector("#fixed")!.scrollTop === 1000);
  await page.waitForFunction(() => document.querySelector("#fixed-index")?.textContent === "20");
  await page.click("#shrink");
  await page.waitForFunction(() => document.querySelector("#fixed .cdk-virtual-scroll-spacer") && (document.querySelector("#fixed .cdk-virtual-scroll-spacer") as HTMLElement).style.height === "1000px");
  await settle(page);
  const rows = await texts(page, "#fixed .row");
  assert.ok(rows.length > 0 && rows.every((t) => Number(t.replace("Item ", "")) < 20), rows.join());
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("viewport: horizontal LTR and RTL", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/scrolling");
  assert.equal(await page.$eval("#horizontal .cdk-virtual-scroll-spacer", (el) => (el as HTMLElement).style.width), "50000px");
  await page.$eval("#horizontal", (el) => (el.scrollLeft = 1000));
  // First visible 20, minus the 100px minimum buffer (2 items).
  await page.waitForFunction(() => document.querySelector("#horizontal .col")?.textContent === "18");
  assert.equal(await page.$eval("#horizontal .cdk-virtual-scroll-content-wrapper", (el) => (el as HTMLElement).style.transform), "translateX(900px)");
  // RTL: scrollLeft goes negative in Chromium; the engine normalizes and translates negatively.
  await page.$eval("#rtl", (el) => (el.scrollLeft = -1000));
  await page.waitForFunction(() => document.querySelector("#rtl .col")?.textContent === "18");
  assert.equal(await page.$eval("#rtl .cdk-virtual-scroll-content-wrapper", (el) => (el as HTMLElement).style.transform), "translateX(-900px)");
  await page.close();
});

test("viewport: autosize rows inside a <ul> (CdkVirtualForOf), appendOnly keeps rows", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/scrolling");
  assert.equal(await page.$$eval("#auto li", (els) => els.length), 8, "estimate 50px: 4 visible + 4 buffer");
  await page.$eval("#auto", (el) => (el.scrollTop = 3000));
  await page.waitForFunction(() => document.querySelector("#auto li")?.textContent !== "Person 0");
  await settle(page);
  const first = await page.$eval("#auto li", (el) => el.textContent);
  assert.notEqual(first, "Person 0");
  // appendOnly: scrolling keeps earlier rows.
  await page.$eval("#append", (el) => (el.scrollTop = 2000));
  await page.waitForFunction(() => document.querySelectorAll("#append .row").length > 40);
  assert.equal(await page.$eval("#append .row", (el) => el.textContent!.trim()), "Item 0");
  assert.equal(await page.$eval("#append .cdk-virtual-scroll-content-wrapper", (el) => (el as HTMLElement).style.transform), "translateY(0px)");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("viewport: ancestor CdkVirtualScrollableElement and window scrolling", async () => {
  const page = await s.browser.newPage({ viewport: { width: 800, height: 600 } });
  const seen = watch(page);
  await page.goto(s.origin + "/scrolling-window");
  assert.equal(await page.getAttribute("#scroller", "class"), "cdk-virtual-scrollable scroller");
  await page.$eval("#scroller", (el) => (el.scrollTop = 1050));
  // The viewport starts ~50px below the scroller's top: offset ≈ 1000 → first visible ≈ 20, minus the buffer.
  await page.waitForFunction(() => {
    const n = Number(document.querySelector("#inner .row")?.textContent?.trim().replace("Inner ", ""));
    return n >= 15 && n <= 18;
  });
  await page.evaluate(() => scrollTo(0, 20000));
  await page.waitForFunction(() => {
    const first = document.querySelector("#win .row")?.textContent?.trim() ?? "";
    return first !== "Window 0" && Number(first.replace("Window ", "")) > 300;
  });
  assert.deepEqual(seen.errors, []);
  await page.close();
});
