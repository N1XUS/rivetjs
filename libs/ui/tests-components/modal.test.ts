// Modal — resumed story app (`/modal`): SSR markup (closed: trigger only), upstream modal.browser.test.tsx (focus trap, scroll
// lock, Escape focus restore; focus restore after CloseTrigger), HeroUI classes + CSS on the open modal (backdrop fixed + tinted,
// dialog surface), `Modal.Trigger` + blur backdrop + placement top, `useOverlayState` + `state` prop (open / toggle, render-function
// `close`), backdrop press dismisses (`isDismissable` default true) and does not with `isDismissable={false}`.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { assertFades, stories, traceFade, watch, type Stories } from "./harness.ts";

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
const inDialog = (page: Page, id: string) => page.waitForFunction((i) => document.getElementById(i)!.contains(document.activeElement), id);

test("modal: SSR closed markup (trigger only)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/modal");
    assert.equal(await page.$("#mo-dialog"), null);
    assert.equal(await page.getAttribute("#mo-mtrigger", "role"), "button");
    assert.equal(await page.getAttribute("#mo-mtrigger", "class"), "modal__trigger");
    assert.equal(await page.textContent("#mo-state"), "closed");
    await page.waitForLoadState("networkidle");
    assert.deepEqual(seen.errors, []);
  }));

test("modal (upstream browser): focus trap, scroll lock, Escape focus restore", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/modal");
    await page.click("#mo-trigger");
    await page.waitForSelector("#mo-dialog");
    await inDialog(page, "mo-dialog");
    await page.waitForFunction(() => getComputedStyle(document.documentElement).overflow === "hidden" || getComputedStyle(document.body).overflow === "hidden");
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      assert.ok(await page.evaluate(() => document.getElementById("mo-dialog")!.contains(document.activeElement)), `tab ${i} left the dialog`);
    }
    // HeroUI CSS: backdrop fixed + tinted, dialog surface.
    assert.equal(await page.$eval("[data-slot=modal-backdrop]", (el) => getComputedStyle(el).position), "fixed");
    assert.notEqual(await page.$eval("[data-slot=modal-backdrop]", (el) => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
    assert.notEqual(await page.$eval("#mo-dialog", (el) => getComputedStyle(el).borderTopLeftRadius), "0px");
    await page.keyboard.press("Escape");
    await page.waitForSelector("#mo-dialog", { state: "detached" });
    assert.equal(await scrollLocked(page), false);
    await page.waitForFunction(() => document.activeElement?.id === "mo-trigger");
    assert.deepEqual(seen.errors, []);
  }));

test("modal (upstream browser): focus restore after CloseTrigger", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/modal");
    await page.click("#mo-trigger");
    await page.waitForSelector("#mo-dialog");
    await page.click("[data-slot=modal-close-trigger]");
    await page.waitForSelector("#mo-dialog", { state: "detached" });
    await page.waitForFunction(() => document.activeElement?.id === "mo-trigger");
    // Footer slot="close" button closes too.
    await page.click("#mo-trigger");
    await page.waitForSelector("#mo-dialog");
    await page.click("#mo-continue");
    await page.waitForSelector("#mo-dialog", { state: "detached" });
  }));

test("modal: Modal.Trigger opens; blur backdrop, placement top, size sm; backdrop press dismisses", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/modal");
    await page.click("#mo-mtrigger");
    await page.waitForSelector("#mo-mdialog");
    assert.match((await page.getAttribute("[data-slot=modal-backdrop]", "class")) ?? "", /modal__backdrop--blur/);
    assert.equal(await page.getAttribute("[data-slot=modal-container]", "data-placement"), "top");
    assert.match((await page.getAttribute("#mo-mdialog", "class")) ?? "", /modal__dialog--sm/);
    await page.waitForFunction(() => !document.querySelector("[data-slot=modal-backdrop]")!.hasAttribute("data-entering"));
    // Top placement: the dialog sits in the upper half of the viewport.
    const top = await page.$eval("#mo-mdialog", (el) => el.getBoundingClientRect().top);
    assert.ok(top < (await page.evaluate(() => innerHeight / 2)), `dialog top ${top}`);
    await page.mouse.click(5, 5);
    await page.waitForSelector("#mo-mdialog", { state: "detached" });
  }));

test("modal: useOverlayState + state prop (open, render-function close, toggle)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/modal");
    await page.click("#mo-open");
    await page.waitForSelector("#mo-sdialog");
    await page.waitForFunction(() => document.querySelector("#mo-state")?.textContent === "open");
    await page.click("#mo-sclose");
    await page.waitForSelector("#mo-sdialog", { state: "detached" });
    await page.waitForFunction(() => document.querySelector("#mo-state")?.textContent === "closed");
    await page.click("#mo-toggle");
    await page.waitForSelector("#mo-sdialog");
    await page.keyboard.press("Escape");
    await page.waitForSelector("#mo-sdialog", { state: "detached" });
    await page.waitForFunction(() => document.querySelector("#mo-state")?.textContent === "closed");
    assert.deepEqual(seen.errors, []);
  }));

test("modal: isDismissable={false} ignores a backdrop press", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/modal");
    await page.click("#mo-nd");
    await page.waitForSelector("#mo-nddialog");
    await page.waitForFunction(() => !document.querySelector("[data-slot=modal-backdrop]")!.hasAttribute("data-entering"));
    await page.mouse.click(5, 5);
    await page.waitForTimeout(300);
    assert.ok(await page.$("#mo-nddialog"));
    await page.keyboard.press("Escape");
    await page.waitForSelector("#mo-nddialog", { state: "detached" });
  }));

// BACKDROP-FIX (2026-10-08): backdrop + dialog keyframe fades (`modal.css` `animate-in fade-in-0` / `animate-out fade-out-0`) on open
// and close, the first open of the resumed page and a later browser-created open.
test("modal: backdrop and dialog fade in and out (first open + reopen)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/modal");
    for (const round of ["first open", "reopen"]) {
      const backdrop = await traceFade(page, "[data-slot=modal-backdrop]");
      const dialog = await traceFade(page, "[data-slot=modal-container]");
      await page.click("#mo-trigger");
      await page.waitForSelector("#mo-dialog");
      await inDialog(page, "mo-dialog");
      // Panel enter = `--overlay-duration` (500 ms, TW-146): let it settle before closing.
      await page.waitForTimeout(650);
      const closedAt = await backdrop.now();
      await page.keyboard.press("Escape");
      await page.waitForSelector("[data-slot=modal-backdrop]", { state: "detached" });
      await page.waitForTimeout(100);
      assertFades(await backdrop.samples(), closedAt, `modal backdrop (${round})`);
      assertFades(await dialog.samples(), closedAt, `modal dialog (${round})`);
      await page.waitForFunction(() => document.activeElement?.id === "mo-trigger");
    }
    assert.deepEqual(seen.errors, []);
  }));
