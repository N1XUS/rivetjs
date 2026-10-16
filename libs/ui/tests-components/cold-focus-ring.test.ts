// Cold press focus ring — resumed story app (`/alert-dialog`) with its scheduled preloads stripped, so the first press
// runs before any chunk (lane RESUME-PINS). A cold mouse click must not show the focus-visible ring: neither on the
// pressed trigger nor on the dialog's script-focused content (HeroUI CSS keys rings on `:focus-visible` /
// `data-focus-visible`). A held mousedown default + script focus once made Chrome's heuristic match every later script
// focus; the loader now leaves the mouse focus native and records `window.__rvIM` for cdk focus-visible. A cold Tab shows it.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function cold(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage();
  try {
    const seen = watch(page);
    await page.route(s.origin + "/alert-dialog", async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace(/ data-preload="[^"]*"/, "") });
    });
    await page.goto(s.origin + "/alert-dialog");
    await body(page);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
}

const ring = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return { id: el?.id ?? "", css: !!el?.matches(":focus-visible"), attr: el?.closest("[data-focus-visible]") != null };
  });

test("cold focus ring: a cold mouse click shows no ring (trigger, dialog content)", () =>
  cold(async (page) => {
    await page.click("#ad-trigger");
    await page.waitForSelector("#ad-dialog[role=alertdialog]");
    await page.waitForFunction(() => document.getElementById("ad-dialog")!.contains(document.activeElement));
    await page.waitForTimeout(100);
    const inside = await ring(page);
    assert.equal(inside.css, false, `dialog focus ${inside.id} matches :focus-visible`);
    assert.equal(inside.attr, false, `dialog focus ${inside.id} carries data-focus-visible`);
    await page.click("#ad-cancel");
    await page.waitForFunction(() => !document.getElementById("ad-dialog"));
    await page.waitForFunction(() => document.activeElement?.id === "ad-trigger");
    const back = await ring(page);
    assert.equal(back.css || back.attr, false, "restored trigger focus shows no ring after mouse presses");
  }));

test("cold focus ring: a cold Tab shows the ring", () =>
  cold(async (page) => {
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => document.activeElement && document.activeElement !== document.body);
    await page.waitForFunction(() => document.activeElement!.matches(":focus-visible"));
    const first = await ring(page);
    assert.equal(first.css, true);
    // Once the chunk ran, the attribute follows keyboard modality.
    for (let i = 0; i < 20 && (await page.evaluate(() => document.activeElement?.id)) !== "ad-trigger"; i++) await page.keyboard.press("Tab");
    assert.equal((await ring(page)).css, true, "trigger reached with Tab");
    await page.keyboard.press("Enter");
    await page.waitForSelector("#ad-dialog[role=alertdialog]");
    await page.waitForFunction(() => document.getElementById("ad-dialog")!.contains(document.activeElement));
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => document.activeElement?.closest("[data-focus-visible]") != null, undefined, { timeout: 3000 });
  }));
