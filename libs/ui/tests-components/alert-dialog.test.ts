// AlertDialog — resumed story app (`/alert-dialog`): SSR markup (closed: trigger only), upstream alert-dialog.browser.test.tsx
// (focus trap + scroll lock while open; Escape blocked, CloseTrigger closes with focus restore), HeroUI CSS (icon tint, dialog
// radius), backdrop press ignored by default; `AlertDialog.Trigger` + `isDismissable` / `isKeyboardDismissDisabled={false}` opt-ins.
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

const scrollLocked = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).overflow === "hidden" || getComputedStyle(document.body).overflow === "hidden");
const entered = (page: Page) => page.waitForFunction(() => !document.querySelector("[data-slot=alert-dialog-backdrop]")?.hasAttribute("data-entering"));

test("alert-dialog: SSR closed markup (trigger only)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/alert-dialog");
    assert.equal(await page.$("#ad-dialog"), null);
    assert.equal(await page.getAttribute("#ad-dtrigger", "class"), "alert-dialog__trigger");
    await page.waitForLoadState("networkidle");
    assert.deepEqual(seen.errors, []);
  }));

test("alert-dialog (upstream browser): focus trap and scroll lock while open", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/alert-dialog");
    await page.click("#ad-trigger");
    await page.waitForSelector("#ad-dialog[role=alertdialog]");
    await page.waitForFunction(() => document.getElementById("ad-dialog")!.contains(document.activeElement));
    await page.waitForFunction(() => getComputedStyle(document.documentElement).overflow === "hidden" || getComputedStyle(document.body).overflow === "hidden");
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      assert.ok(await page.evaluate(() => document.getElementById("ad-dialog")!.contains(document.activeElement)), `tab ${i} left the dialog`);
    }
    // HeroUI CSS: danger icon tint, dialog radius.
    assert.notEqual(await page.$eval("[data-slot=alert-dialog-icon]", (el) => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
    assert.notEqual(await page.$eval("#ad-dialog", (el) => getComputedStyle(el).borderTopLeftRadius), "0px");
    assert.deepEqual(seen.errors, []);
  }));

test("alert-dialog (upstream browser): Escape blocked; backdrop press ignored; CloseTrigger closes with focus restore", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/alert-dialog");
    await page.click("#ad-trigger");
    await page.waitForSelector("#ad-dialog");
    await entered(page);
    await page.keyboard.press("Escape");
    await page.mouse.click(5, 5);
    await page.waitForTimeout(300);
    assert.ok(await page.$("#ad-dialog"));
    await page.click("[data-slot=alert-dialog-close-trigger]");
    await page.waitForSelector("#ad-dialog", { state: "detached" });
    assert.equal(await scrollLocked(page), false);
    await page.waitForFunction(() => document.activeElement?.id === "ad-trigger");
    // Footer slot="close" buttons close too.
    await page.click("#ad-trigger");
    await page.waitForSelector("#ad-dialog");
    await page.click("#ad-delete");
    await page.waitForSelector("#ad-dialog", { state: "detached" });
  }));

test("alert-dialog: AlertDialog.Trigger; isDismissable + Escape opt-ins", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/alert-dialog");
    await page.click("#ad-dtrigger");
    await page.waitForSelector("#ad-ddialog");
    assert.match((await page.getAttribute("#ad-ddialog", "class")) ?? "", /alert-dialog__dialog--sm/);
    await page.keyboard.press("Escape");
    await page.waitForSelector("#ad-ddialog", { state: "detached" });
    await page.click("#ad-dtrigger");
    await page.waitForSelector("#ad-ddialog");
    await entered(page);
    await page.mouse.click(5, 5);
    await page.waitForSelector("#ad-ddialog", { state: "detached" });
  }));
