// UI-BREADCRUMB — `/live-item-text` + `/live-item-text-layout`: signal text in collection item parts (Breadcrumbs.Item,
// ListBox.Item, Tabs.Tab, Tag, Dropdown.Item; slot and function children) follows writes on a resumed page. Before: Tabs.Tab
// read its children once (also client-rendered), ListBox / Menu items read a function child once, and a lazy collection row
// shaped unlike the first row (a function-child Breadcrumbs.Item between links) was never woken by the write.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const texts = (page: Page, sel: string) => page.$$eval(sel, (els) => els.map((el) => (el.textContent ?? "").trim()));

test("collection items: signal children update after a resumed write", async () => {
  const page = await s.browser.newPage();
  try {
    const seen = watch(page);
    await page.goto(s.origin + "/live-item-text");
    assert.deepEqual(await texts(page, "#lit-bc li"), ["Home", "Products", "Item 1"]);
    assert.deepEqual(await texts(page, "#lit-bc-fn li"), ["Home", "Products", "Item 1"]);
    assert.deepEqual(await texts(page, "#lit-bc-mid li"), ["Home", "Products", "Here"]);
    assert.deepEqual(await texts(page, "#lit-lb [role=option]"), ["Products", "Item 1", "Products"]);
    assert.deepEqual(await texts(page, "#lit-tabs [role=tab]"), ["Products", "Item 1", "Products"]);
    assert.deepEqual(await texts(page, "#lit-tg [role=row]"), ["Products", "Item 1", "Products"]);
    await page.click("#lit-set");
    await page
      .waitForFunction(() => document.querySelector("#lit-bc li:last-child")?.textContent?.trim() === "Item 2", null, { timeout: 3000 })
      .catch(() => {});
    const after = {
      bc: await texts(page, "#lit-bc li"),
      bcFn: await texts(page, "#lit-bc-fn li"),
      bcMid: await texts(page, "#lit-bc-mid li"),
      lb: await texts(page, "#lit-lb [role=option]"),
      tabs: await texts(page, "#lit-tabs [role=tab]"),
      tg: await texts(page, "#lit-tg [role=row]"),
    };
    await page.click("#lit-dd-trigger");
    await page.waitForSelector("#lit-dd [role=menuitem]");
    const dd = await texts(page, "#lit-dd [role=menuitem]");
    assert.deepEqual(
      { ...after, dd },
      {
        bc: ["Home", "Devices", "Item 2"],
        bcFn: ["Home", "Devices", "Item 2"],
        bcMid: ["Home", "Devices", "Here"],
        lb: ["Devices", "Item 2", "Devices"],
        tabs: ["Devices", "Item 2", "Devices"],
        tg: ["Devices", "Item 2", "Devices"],
        dd: ["Devices", "Item 2", "Devices"],
      },
    );
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
});

test("breadcrumbs: signal text written by another boundary (component props, AppLayout sidebar → navbar)", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    const seen = watch(page);
    await page.goto(s.origin + "/live-item-text");
    assert.deepEqual(await texts(page, "#lit-x-bc li"), ["Halcyon", "General", "Home"]);
    await page.click("#lit-x-set");
    await page.waitForTimeout(500);
    const x = await texts(page, "#lit-x-bc li");
    await page.goto(s.origin + "/live-item-text-layout");
    assert.deepEqual(await texts(page, "#lit-al-bc li"), ["Halcyon", "General", "Home"]);
    await page.click("#lit-al-support");
    await page.waitForTimeout(500);
    assert.deepEqual(
      { x, al: await texts(page, "#lit-al-bc li") },
      { x: ["Halcyon", "Agents", "Support triage"], al: ["Halcyon", "Agents", "Support triage"] },
    );
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
});
