// Compare — resumed story app (`/compare`; Rivet addition, behaviour `@rivetjs/cdk/compare`): SSR markup (slider ARIA,
// inline clip-path, labels), HeroUI-look CSS sizes (thumb, hit strip, divider), nothing boots at load; resumed handle drag
// follows the pointer 1:1 (onChange readout + one onChangeEnd), keyboard arrows settle through the house motion, vertical
// keys, dragAnywhere jump, controlled Signal both ways, disabled ignores input, 375 px no horizontal scroll.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>, width = 900): Promise<void> {
  const page = await s.browser.newPage({ viewport: { width, height: 1400 } });
  try {
    const seen = watch(page);
    await page.goto(s.origin + "/compare");
    await page.waitForLoadState("networkidle");
    await body(page);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
}

const now = (page: Page, handle: string) => page.locator(handle).evaluate((el) => Number(el.getAttribute("aria-valuenow")));
const text = (page: Page, sel: string) => page.locator(sel).evaluate((el) => el.textContent ?? "");
const box = (page: Page, sel: string) =>
  page.locator(sel).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
const settledAt = (page: Page, handle: string, v: number) =>
  page.waitForFunction(
    ([sel, v]) => {
      const el = document.querySelector(sel as string)!;
      return el.getAttribute("aria-valuenow") === String(v) && !el.closest("[data-rv-compare]")!.hasAttribute("data-moving");
    },
    [handle, v],
  );

test("compare: SSR markup + no boot", async () => {
  const page = await s.browser.newPage();
  try {
    const html = await (await page.request.get(s.origin + "/compare")).text();
    assert.match(html, /<div[^>]*id="cmp"[^>]*class="compare[^"]*"|<div[^>]*class="compare[^"]*"[^>]*id="cmp"/);
    assert.match(html, /role="slider"[^>]*/);
    assert.match(html, /aria-valuenow="50"/);
    assert.match(html, /clip-path: ?inset\(0(px)? 0(px)? 0(px)? 50%\)/);
    assert.match(html, /data-slot="compare-label"[^>]*>Before</);
    assert.doesNotMatch(html, /id="cmp-off-handle"[^>]*tabindex/, "disabled handle: not focusable");
    assert.doesNotMatch(html, /"fx":\[\[/, "no client effect (nothing boots at load)");
    const seen = watch(page);
    await page.goto(s.origin + "/compare");
    await page.waitForLoadState("networkidle");
    assert.equal(await page.evaluate(() => document.querySelector("[data-boot]") === null), true);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
});

test("compare: CSS — round thumb, 44 px hit strip, 2 px divider centred on the position", () =>
  onPage(async (page) => {
    const root = await box(page, "#cmp");
    const handle = await box(page, "#cmp-handle");
    const thumb = await box(page, '#cmp [data-slot="compare-thumb"]');
    assert.equal(Math.round(handle.w), 44);
    assert.equal(Math.round(handle.h), Math.round(root.h));
    assert.equal(Math.round(thumb.w), 40);
    assert.equal(Math.round(thumb.h), 40);
    assert.ok(Math.abs(handle.x + handle.w / 2 - (root.x + root.w / 2)) <= 1, "handle centred at 50 %");
    const divider = await box(page, '#cmp [data-slot="compare-divider"]');
    assert.equal(Math.round(divider.w), 2);
    assert.ok(parseFloat(await page.locator('#cmp [data-slot="compare-thumb"]').evaluate((el) => getComputedStyle(el).borderRadius)) >= 20, "fully rounded");
    const vthumb = await box(page, "#cmp-v-handle");
    const vroot = await box(page, "#cmp-v");
    assert.equal(Math.round(vthumb.h), 44);
    assert.equal(Math.round(vthumb.w), Math.round(vroot.w));
  }));

test("compare: resumed handle drag follows the pointer 1:1, onChange + one onChangeEnd", () =>
  onPage(async (page) => {
    const root = await box(page, "#cmp");
    const h = await box(page, "#cmp-handle");
    const y = h.y + h.h / 2;
    // Grab 4 px right of the line: the grab offset is kept (no jump on press).
    await page.mouse.move(h.x + h.w / 2 + 4, y);
    await page.mouse.down();
    await page.waitForFunction(() => document.querySelector("#cmp")!.getAttribute("data-dragging") === "true");
    assert.equal(await now(page, "#cmp-handle"), 50);
    await page.mouse.move(h.x + h.w / 2 + 4 + root.w * 0.2, y, { steps: 6 });
    await page.waitForFunction(() => document.querySelector("#cmp-handle")!.getAttribute("aria-valuenow") === "70");
    const after = await page.locator("#cmp [data-rv-compare-after]").evaluate((el) => (el as HTMLElement).style.clipPath);
    assert.match(after, /^inset\(0(px)? 0(px)? 0(px)? 70%\)$/);
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector("#cmp-ends")!.textContent === "1");
    assert.equal(await text(page, "#cmp-value"), "70");
    assert.equal(await page.locator("#cmp").getAttribute("data-dragging"), null);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "cmp-handle");
  }));

test("compare: keyboard arrows / Shift / Home / End settle through the motion", () =>
  onPage(async (page) => {
    await page.locator("#cmp-handle").focus();
    await page.keyboard.press("ArrowRight");
    await settledAt(page, "#cmp-handle", 51);
    await page.keyboard.press("Shift+ArrowLeft");
    // Animated: the root carries data-moving while the clip settles.
    await page.waitForFunction(
      () => document.querySelector("#cmp")!.hasAttribute("data-moving") || document.querySelector("#cmp-handle")!.getAttribute("aria-valuenow") === "41",
    );
    await settledAt(page, "#cmp-handle", 41);
    await page.keyboard.press("End");
    await settledAt(page, "#cmp-handle", 100);
    await page.keyboard.press("Home");
    await settledAt(page, "#cmp-handle", 0);
    assert.equal(await text(page, "#cmp-ends"), "4");
    assert.equal(await page.locator("#cmp-handle").getAttribute("data-focus-visible"), "true");
  }));

test("compare: vertical — ArrowDown increases, clip from the top", () =>
  onPage(async (page) => {
    assert.equal(await now(page, "#cmp-v-handle"), 25);
    await page.locator("#cmp-v-handle").focus();
    await page.keyboard.press("ArrowDown");
    await settledAt(page, "#cmp-v-handle", 26);
    const clip = await page.locator("#cmp-v [data-rv-compare-after]").evaluate((el) => (el as HTMLElement).style.clipPath);
    assert.match(clip, /^inset\(26%/);
  }));

test("compare: dragAnywhere — a press on the surface moves the divider there", () =>
  onPage(async (page) => {
    const r = await box(page, "#cmp-any");
    await page.mouse.click(r.x + r.w * 0.25, r.y + r.h / 2);
    await settledAt(page, "#cmp-any-handle", 25);
    const r2 = await box(page, "#cmp");
    // Without dragAnywhere a surface press does nothing.
    await page.mouse.click(r2.x + r2.w * 0.1, r2.y + 20);
    await page.waitForTimeout(300);
    assert.equal(await now(page, "#cmp-handle"), 50);
  }));

test("compare: controlled Signal — outside write moves the handle, drag writes back", () =>
  onPage(async (page) => {
    assert.equal(await now(page, "#cmp-ctl-handle"), 30);
    await page.click("#cmp-ctl-set");
    await page.waitForFunction(() => document.querySelector("#cmp-ctl-handle")!.getAttribute("aria-valuenow") === "80");
    await page.locator("#cmp-ctl-handle").focus();
    await page.keyboard.press("ArrowLeft");
    await settledAt(page, "#cmp-ctl-handle", 79);
    assert.equal(await text(page, "#cmp-ctl-value"), "79");
  }));

test("compare: isDisabled ignores keys and drags", () =>
  onPage(async (page) => {
    const h = await box(page, "#cmp-off-handle");
    await page.mouse.move(h.x + h.w / 2, h.y + h.h / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + h.w / 2 + 100, h.y + h.h / 2, { steps: 4 });
    await page.mouse.up();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(200);
    assert.equal(await now(page, "#cmp-off-handle"), 50);
    assert.equal(await page.locator("#cmp-off").getAttribute("data-disabled"), "true");
  }));

test("compare: 375 px no horizontal scroll", () =>
  onPage(async (page) => {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  }, 375));
