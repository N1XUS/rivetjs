// <Virtualizer> in the resumed story app (10k rows, ListLayout with estimated sizes; RTL horizontal list):
// server-rendered first window, zero library JS before the first scroll, only the window in the DOM,
// scrolling renders a new window, keyed reuse of row nodes, measured variable heights, RTL scrollLeft.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, libraryScripts, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const views = (page: Page, sel: string) =>
  page.$$eval(`${sel} [data-rv-view]`, (els) =>
    els.map((el) => {
      const st = (el as HTMLElement).style;
      return { key: Number(el.getAttribute("data-rv-view")), top: st.top, right: st.right, height: st.height };
    }),
  );
const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60))));
type W = { kept: Element };

test("list: server window, no library JS before scroll, new window on scroll, keyed reuse, measured heights", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/virtualizer");
  // Server window: 300px viewport + overscan at 32px estimated rows (rows 0..13).
  const first = await views(page, "#list");
  assert.deepEqual(first.map((v) => v.key), [...Array(14).keys()]);
  assert.deepEqual(first[1], { key: 1, top: "32px", right: "", height: "32px" });
  assert.equal(await page.$eval("#list .rv-Virtualizer-content", (el) => (el as HTMLElement).style.height), "320000px");
  assert.equal(await page.getAttribute("#list", "role"), "list");
  assert.deepEqual(libraryScripts(seen), [], "no library code before the first scroll");
  // First scroll resumes the engine; server rows that stay in view are adopted (same DOM nodes).
  await page.evaluate(() => ((window as unknown as W).kept = document.querySelector('#list [data-rv-view="5"]')!));
  await page.$eval("#list", (el) => (el.scrollTop = 20));
  await page.waitForFunction(() => (document.querySelector('#list [data-rv-view="1"]') as HTMLElement | null)?.style.top === "64px");
  await settle(page);
  assert.ok(await page.evaluate(() => (window as unknown as W).kept === document.querySelector('#list [data-rv-view="5"]')), "server row adopted");
  assert.ok(libraryScripts(seen).length > 0, "engine loaded on scroll");
  // Measured: row 0 (a 64px row) was estimated at 32px; row 1 now starts at 64px (awaited above).
  // Far scroll: a new window, only the window in the DOM.
  await page.$eval("#list", (el) => (el.scrollTop = 3000));
  await page.waitForFunction(() => !!document.querySelector('#list [data-rv-view="100"]'));
  await settle(page);
  const far = await views(page, "#list");
  assert.ok(far.length > 5 && far.length <= 25, `only the window is in the DOM (${far.length})`);
  assert.ok(far.every((v) => v.key > 50 && v.key < 150), far.map((v) => v.key).join());
  // Variable heights: every 7th row measures 64px and pushes its successor.
  const r98 = far.find((v) => v.key === 98)!;
  const r99 = far.find((v) => v.key === 99)!;
  assert.equal(r98.height, "64px");
  assert.equal(parseFloat(r99.top) - parseFloat(r98.top), 64);
  // Keyed reuse between client scrolls: a row kept in the window keeps its DOM node.
  await page.evaluate(() => ((window as unknown as W).kept = document.querySelector('#list [data-rv-view="100"]')!));
  await page.$eval("#list", (el) => (el.scrollTop = 3100));
  await page.waitForFunction(() => !!document.querySelector('#list [data-rv-view="104"]'));
  await settle(page);
  assert.ok(await page.evaluate(() => (window as unknown as W).kept === document.querySelector('#list [data-rv-view="100"]')), "row node reused");
  assert.deepEqual(seen.errors, []);
  await page.close();

});

test("rtl horizontal: views positioned from the right, negative scrollLeft normalized", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/virtualizer");
  const first = await views(page, "#rtl");
  assert.deepEqual(first.map((v) => v.key), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(first[2], { key: 2, top: "0px", right: "100px", height: "60px" });
  await page.$eval("#rtl", (el) => (el.scrollLeft = -1000));
  await page.waitForFunction(() => !!document.querySelector('#rtl [data-rv-view="22"]'));
  await settle(page);
  const keys = (await views(page, "#rtl")).map((v) => v.key);
  assert.ok(keys.includes(20) && keys.includes(23) && keys.every((k) => k >= 15 && k <= 30), keys.join());
  assert.equal((await views(page, "#rtl")).find((v) => v.key === 20)!.right, "1000px");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
