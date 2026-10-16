// DisclosureGroup — resumed story app (`/disclosure-group`): SSR markup (group BEM block, one expanded item); single expansion
// through the triggers updates the two-way `expandedKeys` signal; `useDisclosureGroupNavigation` buttons (resumed
// `onPress={nav.onNext}`, `isDisabled` accessors at the bounds); `allowsMultipleExpanded` keeps both open.
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
    await page.goto(s.origin + "/disclosure-group");
    await page.waitForLoadState("networkidle");
    await body(page);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
}

const trigger = (group: string, n: number) => `#${group} [data-slot=disclosure]:nth-child(${n}) [data-slot=disclosure-trigger]`;
const expanded = (page: Page, group: string) =>
  page.$$eval(`#${group} [data-slot=disclosure-trigger]`, (els) => els.map((e) => e.getAttribute("aria-expanded")).join(","));
const keysAre = (page: Page, keys: string) => page.waitForFunction((k) => document.querySelector("#dg-keys")?.textContent === k, keys);

test("disclosure-group: SSR markup", async () => {
  const page = await s.browser.newPage();
  try {
    const html = await (await page.request.get(s.origin + "/disclosure-group")).text();
    assert.match(html, /data-slot="disclosure-group"/);
    assert.match(html, /class="disclosure-group"/);
    assert.match(html, /id="dg-keys"[^>]*>(?:<!--[^]*?-->)*dg-a/);
  } finally {
    await page.close();
  }
});

test("disclosure-group: single expansion through the triggers drives the expandedKeys signal", () =>
  onPage(async (page) => {
    assert.equal(await expanded(page, "dg"), "true,false,false");
    await page.click(trigger("dg", 2));
    await keysAre(page, "dg-b");
    assert.equal(await expanded(page, "dg"), "false,true,false");
    await page.click(trigger("dg", 2));
    await keysAre(page, "");
  }));

test("disclosure-group: useDisclosureGroupNavigation buttons on the resumed page", () =>
  onPage(async (page) => {
    assert.equal(await page.isDisabled("#dg-prev"), true);
    await page.click("#dg-next");
    await keysAre(page, "dg-b");
    assert.equal(await expanded(page, "dg"), "false,true,false");
    assert.equal(await page.isDisabled("#dg-prev"), false);
    await page.click("#dg-next");
    await keysAre(page, "dg-c");
    await page.waitForFunction(() => (document.querySelector("#dg-next") as HTMLButtonElement).disabled);
    await page.click("#dg-prev");
    await keysAre(page, "dg-b");
  }));

test("disclosure-group: allowsMultipleExpanded keeps both items open", () =>
  onPage(async (page) => {
    await page.click(trigger("dgm", 1));
    await page.waitForFunction(() => document.querySelector("#dgm [data-slot=disclosure-trigger]")?.getAttribute("aria-expanded") === "true");
    await page.click(trigger("dgm", 2));
    await page.waitForFunction(() => document.querySelectorAll('#dgm [aria-expanded="true"]').length === 2);
    assert.equal(await expanded(page, "dgm"), "true,true");
  }));
