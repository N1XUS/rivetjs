// Stepper — resumed story app (`/stepper`): SSR markup + Rivet-authored CSS (indicator size, active / complete colours,
// separator fill scale, last separator hidden, vertical layout); resumed clicks on a step button select it (onStepChange,
// statuses, aria-current, separator fill), external Back / Next drive the controlled signal; keyboard Tab + Enter;
// display-only stepper ignores clicks.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 900 } });
  try {
    const seen = watch(page);
    await page.goto(s.origin + "/stepper");
    await page.waitForLoadState("networkidle");
    await body(page);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
}

const statuses = (page: Page, root: string) => page.$$eval(`${root} > [data-slot="stepper-step"]`, (els) => els.map((e) => e.getAttribute("data-status")));
const css = (page: Page, sel: string, prop: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
const settled = (page: Page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));

test("stepper: SSR markup", async () => {
  const page = await s.browser.newPage();
  try {
    const html = await (await page.request.get(s.origin + "/stepper")).text();
    assert.match(html, /<ol[^>]*id="st"/);
    assert.match(html, /class="stepper stepper--horizontal stepper--md"/);
    assert.match(html, /data-clickable="true"/);
    assert.match(html, /id="st-still"[^>]*data-readonly="true"|data-readonly="true"[^>]*id="st-still"/);
  } finally {
    await page.close();
  }
});

test("stepper: CSS — indicator size + colours, last separator hidden, vertical layout", () =>
  onPage(async (page) => {
    const box = await page.locator('#st [data-slot="stepper-indicator"]').first().boundingBox();
    assert.equal(Math.round(box!.width), 32);
    assert.equal(Math.round(box!.height), 32);
    const active = await css(page, '#st [data-slot="stepper-indicator"][data-status="active"]', "border-top-color");
    const inactive = await css(page, '#st [data-slot="stepper-indicator"][data-status="inactive"]', "border-top-color");
    assert.notEqual(active, inactive);
    const seps = page.locator('#st [data-slot="stepper-separator"]');
    assert.equal(await seps.nth(2).isVisible(), false, "last separator hidden");
    assert.equal(await seps.nth(0).isVisible(), true);
    const vbox = await page.locator('#st-v [data-slot="stepper-indicator"]').first().boundingBox();
    assert.equal(Math.round(vbox!.width), 24, "sm");
    const vsteps = page.locator('#st-v > [data-slot="stepper-step"]');
    const a = await vsteps.nth(0).boundingBox();
    const b = await vsteps.nth(1).boundingBox();
    assert.ok(b!.y > a!.y + a!.height - 1, "vertical stacks");
    const vsep = await page.locator('#st-v [data-slot="stepper-separator"]').first().boundingBox();
    assert.ok(vsep!.height > vsep!.width, "vertical separator");
  }));

test("stepper: resumed click selects a step, separator fills, Back / Next drive the signal", () =>
  onPage(async (page) => {
    assert.deepEqual(await statuses(page, "#st"), ["active", "inactive", "inactive"]);
    await page.click('#st [data-slot="stepper-step"]:nth-child(3) [data-slot="stepper-step-button"]');
    await page.waitForFunction(() => document.querySelector("#st-state")?.textContent === "2");
    assert.deepEqual(await statuses(page, "#st"), ["complete", "complete", "active"]);
    assert.equal(await page.getAttribute('#st > [data-slot="stepper-step"]:nth-child(3)', "aria-current"), "step");
    await settled(page);
    const fill = await css(page, '#st [data-slot="stepper-separator-fill"]', "transform");
    assert.match(fill, /matrix\(1, 0, 0, 1, 0, 0\)|none/);
    await page.click("#st-back");
    await page.waitForFunction(() => document.querySelector("#st-state")?.textContent === "1");
    assert.deepEqual(await statuses(page, "#st"), ["complete", "active", "inactive"]);
    await page.click("#st-next");
    await page.waitForFunction(() => document.querySelector("#st-state")?.textContent === "2");
  }));

test("stepper: keyboard Tab + Enter selects; display-only ignores clicks", () =>
  onPage(async (page) => {
    await page.locator('#st [data-slot="stepper-step-button"]').nth(1).focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#st-state")?.textContent === "1");
    assert.deepEqual(await statuses(page, "#st-still"), ["complete", "active"]);
    await page.click('#st-still [data-slot="stepper-step-button"]');
    await page.waitForTimeout(100);
    assert.deepEqual(await statuses(page, "#st-still"), ["complete", "active"]);
  }));

test("stepper: resumed Step shorthand (title / description) renders the parts and selects", () =>
  onPage(async (page) => {
    assert.deepEqual(await page.$$eval('#st-short [data-slot="stepper-title"]', (els) => els.map((e) => e.textContent)), ["Account", "Profile", "Done"]);
    assert.equal(await page.$eval('#st-short [data-slot="stepper-description"]', (el) => el.textContent), "Email and password");
    assert.deepEqual(await statuses(page, "#st-short"), ["active", "inactive", "inactive"]);
    await page.click('#st-short [data-slot="stepper-step"]:nth-child(2) [data-slot="stepper-step-button"]');
    await page.waitForFunction(() => document.querySelector("#st-short-state")?.textContent === "1");
    assert.deepEqual(await statuses(page, "#st-short"), ["complete", "active", "inactive"]);
  }));
