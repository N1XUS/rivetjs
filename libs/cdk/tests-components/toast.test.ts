// Toast on a resumed page (story `/toast`): the server renders no region and no toast code loads before
// interaction; the first `queue.add` (a resumed Button handler) wakes the ToastRegion, which appears in a
// portal as a landmark region with the toast; close button, F6 landmark navigation, timer dismissal.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { among, codeOf, stories, watch, libraryScripts, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

// Toast / landmark code: chunks holding their symbols + the shared code only they import (build manifest).
const toastScripts = (seen: { scripts: string[] }) => among(seen.scripts, codeOf(/^@rivetjs\/cdk\/(toast|landmark)\/|#Toast\w*\$/));

test("toast: no region on the server, region appears with the first toast after resume", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/toast");
  assert.equal(await page.$('[role="region"]'), null, "no server-rendered region");
  assert.equal(await page.$('[role="alertdialog"]'), null);
  assert.deepEqual(toastScripts(seen), [], "no toast code before interaction");
  assert.deepEqual(libraryScripts(seen), [], "no library code before interaction");

  await page.click("#add");
  await page.waitForSelector('[role="alertdialog"]');
  const region = await page.$eval('[role="region"]', (el) => ({
    label: el.getAttribute("aria-label"),
    cls: el.className,
    tabIndex: el.getAttribute("tabindex"),
    inApp: !!el.closest("section"),
  }));
  assert.deepEqual(region, { label: "1 notification.", cls: "rv-ToastRegion", tabIndex: "-1", inApp: false });
  const toast = await page.$eval('[role="alertdialog"]', (el) => {
    const title = document.getElementById(el.getAttribute("aria-labelledby")!);
    const description = document.getElementById(el.getAttribute("aria-describedby") ?? "");
    return { cls: el.className, title: title?.textContent, description: description?.textContent, alert: !!el.querySelector('[role="alert"]') };
  });
  assert.deepEqual(toast, { cls: "toast", title: "Saved", description: "Your changes were saved.", alert: true });
  assert.equal(await page.getAttribute('[role="alertdialog"] .close', "aria-label"), "Close");

  // Second toast; the label counts them.
  await page.click("#add");
  await page.waitForFunction(() => document.querySelectorAll('[role="alertdialog"]').length === 2);
  assert.equal(await page.getAttribute('[role="region"]', "aria-label"), "2 notifications.");

  // F6 moves focus into the region (landmark navigation).
  await page.focus("#add");
  await page.keyboard.press("F6");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("role")), "region");

  // Close buttons remove the toasts; the region goes away with the last one.
  await page.click('[role="alertdialog"] .close');
  await page.waitForFunction(() => document.querySelectorAll('[role="alertdialog"]').length === 1);
  await page.click('[role="alertdialog"] .close');
  await page.waitForFunction(() => !document.querySelector('[role="region"]'));
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("toast: timed toast dismisses itself after resume", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.clock.install();
  await page.goto(s.origin + "/toast");
  await page.click("#add-timed");
  await page.waitForSelector('[role="alertdialog"]');
  // Pointer away from the region so hover does not pause the timer.
  await page.mouse.move(0, 0);
  await page.clock.runFor(5100);
  await page.waitForFunction(() => !document.querySelector('[role="alertdialog"]'));
  assert.deepEqual(seen.errors, []);
  await page.close();
});
