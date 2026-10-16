// Button / CloseButton / Link — resumed story app: SSR classes, press after the first click, accessor state, `render`.
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

// Unlike Card, cdk Button / Link preload their resume chunks on load (even a plain `<Button>`; measured with throwaway routes), so no
// "no JS before interaction" assertion here; the Card route keeps that gate for the pure-markup components.
test("button: SSR classes + data-slot, styles applied", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/button");
    assert.match((await page.getAttribute("#b-press", "class")) ?? "", /^button button--md button--secondary$/);
    assert.equal(await page.getAttribute("#b-press", "data-slot"), "button");
    assert.equal(await page.getAttribute("#b-close", "aria-label"), "Close");
    assert.equal(await page.getAttribute("#b-render", "href"), "#anchor");
    assert.equal(await page.$eval("#b-render", (el) => el.tagName), "A");
    assert.equal(await page.getAttribute("#l-docs", "class"), "link");
    assert.equal(await page.getAttribute("#l-docs [data-slot=link-icon]", "class"), "link__icon");
    assert.notEqual(await page.$eval("#b-press", (el) => getComputedStyle(el).paddingLeft), "0px");
    await page.waitForLoadState("networkidle");
    assert.deepEqual(seen.errors, []);
  }));

test("button: resumed press runs onPress; CloseButton press; pending accessor toggles data-pending + render-prop text", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/button");
    await page.click("#b-press");
    await page.waitForFunction(() => document.querySelector("#b-count")?.textContent === "1");
    await page.click("#b-press");
    await page.waitForFunction(() => document.querySelector("#b-count")?.textContent === "2");
    await page.click("#b-close");
    await page.waitForFunction(() => document.querySelector("#b-closed")?.textContent === "1");
    await page.click("#b-pending");
    await page.waitForFunction(() => document.querySelector("#b-pending")?.getAttribute("data-pending") === "true");
    assert.equal(await page.textContent("#b-pending"), "busy");
    assert.deepEqual(seen.errors, []);
  }));
