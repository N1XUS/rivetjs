// Toast — resumed story app (`/toast`): SSR renders only the region anchors (no region, no toast); upstream
// toast.browser.test.tsx (first toast shows the region + alertdialog, Close dismisses it after the exit animation); HeroUI CSS
// (fixed zero-height region at the viewport bottom, close button revealed on hover, stacked back toast scaled down, hover expands the stack); upstream keyboard cases on a
// real keyboard (Tab to the frontmost toast + its Close, Enter closes it, focus moves to the remaining toast; Alt+T focuses +
// expands the region, Escape collapses it); success toast action; promise toast swaps loading → success and auto-dismisses;
// a second module-level queue (`name`) wakes its own top-end region.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 700 } });
  try {
    const seen = watch(page);
    await page.goto(s.origin + "/toast");
    await page.waitForLoadState("networkidle");
    await body(page);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
}

const settled = (page: Page) =>
  page.waitForFunction(() => !document.querySelector("[data-entering]") && document.getAnimations().every((a) => a.playState !== "running"));

const visibleDialogs = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[role="alertdialog"]')].filter((el) => !el.hasAttribute("data-exiting")).map((el) => el.textContent ?? ""),
  );

test("toast: SSR renders only the region anchors", async () => {
  const page = await s.browser.newPage();
  try {
    const html = await (await page.request.get(s.origin + "/toast")).text();
    assert.equal((html.match(/data-rv-toast-anchor/g) ?? []).length, 2);
    assert.doesNotMatch(html, /role="region"/);
    assert.doesNotMatch(html, /alertdialog/);
  } finally {
    await page.close();
  }
});

test("toast: shows a toast in the region and dismisses it via Close (upstream browser test)", () =>
  onPage(async (page) => {
    await page.click("#t-add");
    await page.waitForSelector('[role="alertdialog"]');
    const region = page.locator('[role="region"]');
    assert.equal(await region.count(), 1);
    assert.equal(await region.getAttribute("data-slot"), "toast-region");
    assert.match((await page.textContent('[role="alertdialog"]')) ?? "", /Saved/);
    // HeroUI CSS: the region is fixed to the viewport bottom.
    const css = await region.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { position: cs.position, bottom: el.getBoundingClientRect().bottom };
    });
    assert.equal(css.position, "fixed");
    assert.ok(css.bottom <= 700 && css.bottom > 600, `bottom ${css.bottom}`);
    await settled(page);
    // HeroUI CSS reveals the close button on hover (pointer-events none until then).
    await page.hover('[data-slot="toast"]');
    await page.click('[role="alertdialog"] [data-slot="toast-close"]');
    await page.waitForFunction(() => !document.querySelector('[role="alertdialog"]'));
  }));

test("toast: stacks newest frontmost, back toast scaled; hover expands", () =>
  onPage(async (page) => {
    await page.click("#t-add");
    await page.click("#t-success");
    await page.waitForFunction(() => document.querySelectorAll('[role="alertdialog"]').length === 2);
    await settled(page);
    const toasts = page.locator('[data-slot="toast"]');
    assert.equal(await toasts.nth(0).getAttribute("data-frontmost"), "true");
    assert.match((await toasts.nth(0).textContent()) ?? "", /Uploaded/);
    assert.equal(await toasts.nth(1).getAttribute("data-index"), "1");
    // Every toast is measured after insertion (a toast added to a live region got scrollHeight 0 before it was connected).
    const heights = await toasts.evaluateAll((els) => els.map((el) => (el as HTMLElement).style.getPropertyValue("--toast-height")));
    assert.ok(
      heights.every((h) => parseFloat(h) > 40),
      `heights ${heights}`,
    );
    const scale = (i: number) => toasts.nth(i).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    assert.equal(await scale(0), 1);
    assert.ok((await scale(1)) < 1, "back toast scaled down");
    await toasts.nth(0).hover();
    await page.waitForSelector('[role="region"][data-expanded="true"]', { state: "attached" });
    await settled(page);
    assert.equal(await scale(1), 1);
    // Success toast action.
    await page.click('[data-slot="toast-action-button"]');
    await page.waitForFunction(() => document.querySelector("#t-state")?.textContent === "1");
  }));

test("toast: keyboard close of the frontmost toast moves focus to the remaining toast (upstream)", () =>
  onPage(async (page) => {
    // Bottom queue only: every provider handles Alt+T (upstream), so a toast in the top-end region would take the focus.
    await page.click("#t-add");
    await page.click("#t-success");
    await page.waitForFunction(() => document.querySelectorAll('[role="alertdialog"]').length === 2);
    await settled(page);
    // Alt+T focuses the bottom region (expanded); Escape collapses it again.
    await page.keyboard.press("Alt+KeyT");
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "region");
    await page.waitForSelector('[role="region"][data-slot="toast-region"][data-expanded="true"]', { state: "attached" });
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("role")), "alertdialog");
    assert.match((await page.evaluate(() => document.activeElement?.textContent)) ?? "", /Uploaded/);
    // Tab past the action button to Close; Enter closes the frontmost toast.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-slot")), "toast-close");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "alertdialog" && /Saved/.test(document.activeElement.textContent ?? ""));
    assert.deepEqual(
      (await visibleDialogs(page)).filter((t) => /Uploaded/.test(t)),
      [],
    );
    await page.keyboard.press("Escape");
  }));

test("toast: Escape collapses the stack expanded by Alt+T (upstream)", () =>
  onPage(async (page) => {
    await page.click("#t-add");
    await page.click("#t-add");
    await page.waitForFunction(() => document.querySelectorAll('[role="alertdialog"]').length === 2);
    await page.keyboard.press("Alt+KeyT");
    await page.waitForSelector('[role="region"][data-expanded="true"]', { state: "attached" });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector('[role="region"]')?.getAttribute("data-expanded") !== "true");
    assert.notEqual(await page.evaluate(() => document.activeElement?.getAttribute("role")), "region");
  }));

test("toast: promise toast swaps loading → success, then auto-dismisses", () =>
  onPage(async (page) => {
    await page.click("#t-promise");
    await page.waitForSelector('[role="alertdialog"]:has-text("Generating")');
    await page.waitForSelector('[role="alertdialog"]:has-text("Created report.pdf")');
    assert.equal(await page.getAttribute('[data-slot="toast-indicator"]', "data-swapped"), "true");
    await page.waitForFunction(() => !document.querySelector('[role="alertdialog"]'), undefined, { timeout: 8000 });
  }));

test("toast: a second named queue wakes its own top-end region", () =>
  onPage(async (page) => {
    await page.click("#t-custom");
    await page.waitForSelector('[role="alertdialog"]:has-text("Custom queue")');
    const regions = page.locator('[role="region"]');
    assert.equal(await regions.count(), 1);
    assert.match((await regions.getAttribute("class")) ?? "", /toast-region--top-end|top/);
    assert.ok((await regions.evaluate((el) => el.getBoundingClientRect().top)) < 100);
    await page.click("#t-add");
    await page.waitForFunction(() => document.querySelectorAll('[role="region"]').length === 2);
    await page.click("#t-clear");
    await page.waitForFunction(() => !document.querySelector('[role="alertdialog"]'));
  }));
