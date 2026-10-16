// Identified cdk contexts (`resumableContext`): a `PortalProvider` / `I18nProvider` outside any region
// wraps a component that re-creates on its first change on the resumed page; the re-created content
// keeps reading both providers (no "Missing resume context token", portal mounts into the container).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("resume context: PortalProvider / I18nProvider values survive region re-creation", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/resume-context");
  assert.equal(await page.getAttribute("#rc-region", "data-locale"), "de-DE");
  assert.equal(await page.locator("#rc-portaled").count(), 0);
  await page.click("#rc-toggle");
  await page.waitForSelector("#rc-host #rc-portaled");
  assert.equal(await page.getAttribute("#rc-region", "data-locale"), "de-DE");
  assert.equal(await page.getAttribute("#rc-portaled", "data-locale"), "de-DE");
  assert.equal(await page.textContent("#rc-open"), "true");
  await page.click("#rc-toggle");
  await page.waitForSelector("#rc-portaled", { state: "detached" });
  await page.click("#rc-toggle");
  await page.waitForSelector("#rc-host #rc-portaled");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("resume context: a PortalProvider container given as an element ref() survives re-creation (element ref entry)", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/resume-context");
  assert.equal(await page.getAttribute("#re-region", "data-locale"), "fr-FR");
  await page.click("#re-toggle");
  await page.waitForSelector("#re-host #re-portaled");
  assert.equal(await page.getAttribute("#re-portaled", "data-locale"), "fr-FR");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
