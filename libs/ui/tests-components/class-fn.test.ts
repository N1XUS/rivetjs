// Function `class` on ui parts (ToggleButton, Button, ProgressBar) on a resumed page: the composed render-prop class
// (`composeTwRenderProps`, `src/utils/compose.tsx`) is captured by the cdk element's class binding and must resume (review I1).
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

const cls = (page: Page, selector: string) => page.$eval(selector, (el) => el.getAttribute("class") ?? "");
const waitClass = (page: Page, selector: string, re: RegExp) =>
  page.waitForFunction(([sel, src]) => new RegExp(src!).test(document.querySelector(sel!)?.getAttribute("class") ?? ""), [selector, re.source] as const);

test("class-fn: SSR composes the function class with the tv classes", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/class-fn");
    assert.match(await cls(page, "#cf-toggle"), /^toggle-button .*cf-off$/);
    assert.match(await cls(page, "#cf-button"), /^button .*cf-idle$/);
    assert.match(await cls(page, "#cf-progress"), /^progress-bar .*cf-p25$/);
  }));

test("class-fn: ToggleButton function class follows isSelected after resume (both ways, no errors)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/class-fn");
    await page.click("#cf-toggle");
    await waitClass(page, "#cf-toggle", /cf-on/);
    assert.match(await cls(page, "#cf-toggle"), /toggle-button/);
    await page.click("#cf-toggle");
    await waitClass(page, "#cf-toggle", /cf-off/);
    assert.deepEqual(seen.errors, []);
  }));

test("class-fn: Button function class follows isHovered after resume; press still fires", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/class-fn");
    await page.waitForLoadState("networkidle");
    await page.hover("#cf-button");
    await waitClass(page, "#cf-button", /cf-hover/);
    assert.match(await cls(page, "#cf-button"), /^button /);
    await page.click("#cf-button");
    await page.waitForFunction(() => document.querySelector("#cf-presses")?.textContent === "1");
    await page.mouse.move(0, 0);
    await waitClass(page, "#cf-button", /cf-idle/);
    assert.deepEqual(seen.errors, []);
  }));

test("class-fn: ProgressBar function class follows percentage after resume", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/class-fn");
    for (const want of [50, 75, 100, 25]) {
      await page.click("#cf-next");
      await waitClass(page, "#cf-progress", new RegExp(`cf-p${want}$`));
      assert.match(await cls(page, "#cf-progress"), /^progress-bar /);
    }
    assert.deepEqual(seen.errors, []);
  }));
