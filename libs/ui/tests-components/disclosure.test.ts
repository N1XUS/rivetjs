// Disclosure — resumed story app (`/disclosure`): SSR markup (collapsed panel hidden, HeroUI classes); upstream keyboard case on a
// real keyboard (focus the trigger, Enter expands, Space collapses); mouse toggle on the resumed page (aria-expanded,
// `onExpandedChange`, panel visible, HeroUI CSS: panel height animates to the content and back to 0, indicator rotated 180°);
// defaultExpanded panel visible at load and collapses.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { eased, stories, traceHeight, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 700 } });
  try {
    const seen = watch(page);
    await page.goto(s.origin + "/disclosure");
    await page.waitForLoadState("networkidle");
    await body(page);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
}

const settled = (page: Page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
const height = (page: Page, sel: string) => page.locator(sel).evaluate((el) => el.getBoundingClientRect().height);
const rotation = (page: Page, sel: string) => page.locator(sel).evaluate((el) => getComputedStyle(el).rotate + "|" + getComputedStyle(el).transform);

test("disclosure: SSR markup", async () => {
  const page = await s.browser.newPage();
  try {
    const html = await (await page.request.get(s.origin + "/disclosure")).text();
    assert.match(html, /id="ds-panel"[^>]*hidden|hidden[^>]*id="ds-panel"/);
    assert.match(html, /class="disclosure__trigger"/);
    assert.match(html, /aria-expanded="true"/);
  } finally {
    await page.close();
  }
});

test("disclosure: keyboard Enter expands, Space collapses (upstream)", () =>
  onPage(async (page) => {
    await page.locator("#ds-trigger").focus();
    assert.equal(await page.evaluate(() => document.activeElement?.id), "ds-trigger");
    assert.equal(await page.getAttribute("#ds-trigger", "aria-expanded"), "false");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#ds-trigger")?.getAttribute("aria-expanded") === "true");
    await page.keyboard.press(" ");
    await page.waitForFunction(() => document.querySelector("#ds-trigger")?.getAttribute("aria-expanded") === "false");
  }));

test("disclosure: mouse toggle on the resumed page + HeroUI CSS", () =>
  onPage(async (page) => {
    assert.equal(await height(page, "#ds-panel"), 0);
    await page.click("#ds-trigger");
    await page.waitForFunction(() => document.querySelector("#ds-state")?.textContent === "true");
    await page.waitForFunction(() => !document.querySelector("#ds-panel")?.hasAttribute("hidden"));
    await settled(page);
    assert.equal(await page.getAttribute("#ds-panel", "data-expanded"), "true");
    assert.ok((await height(page, "#ds-panel")) > 20, "panel expanded to its content");
    assert.equal(await page.getAttribute("#ds-indicator", "data-expanded"), "true");
    assert.match(await rotation(page, "#ds-indicator"), /-180deg|matrix\(-1/);
    await page.click("#ds-trigger");
    await page.waitForFunction(() => document.querySelector("#ds-state")?.textContent === "false");
    await settled(page);
    assert.equal(await height(page, "#ds-panel"), 0);
  }));

// ACCORDION-MOTION: the cdk panel eases both ways (`--disclosure-panel-height` in px while it animates).
test("disclosure: panel height eases open and closed (no snap)", () =>
  onPage(async (page) => {
    const open = await traceHeight(page, "#ds-trigger", "#ds-panel");
    const full = open.at(-1)![1];
    assert.ok(full > 20, `panel opened (${full})`);
    const close = await traceHeight(page, "#ds-trigger", "#ds-panel");
    assert.equal(close.at(-1)![1], 0);
    assert.deepEqual([eased(open, 0, full), eased(close, full, 0)], [true, true], JSON.stringify({ open, close }));
  }));

test("disclosure: defaultExpanded panel visible at load, collapses on press", () =>
  onPage(async (page) => {
    assert.ok((await height(page, "#dso-panel")) > 20);
    await page.click("#dso-trigger");
    await page.waitForFunction(() => document.querySelector("#dso-trigger")?.getAttribute("aria-expanded") === "false");
    await settled(page);
    assert.equal(await height(page, "#dso-panel"), 0);
  }));
