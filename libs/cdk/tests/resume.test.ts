// Resumed story pages (production build): zero JavaScript until interaction, no component runs in
// the browser, behaviour after resume.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, componentRan, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const attr = (page: import("playwright").Page, selector: string, name: string, value: string | null) =>
  page.waitForFunction(([selector, name, value]) => document.querySelector(selector!)?.getAttribute(name!) === value, [selector, name, value] as const);

test("accordion (Disclosure + Angular extras): single expansion, events, disabled item, multi + openAll / closeAll", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/accordion");
  const button = (name: string) => `.item-${name} button`;
  const panel = (name: string) => `.item-${name} .rv-DisclosurePanel`;
  assert.equal(await page.getAttribute(button("one"), "aria-expanded"), "false");
  assert.notEqual(await page.getAttribute(panel("one"), "hidden"), null, "collapsed panel is hidden (RA: `hidden` on the server)");
  await page.click(button("one"));
  await attr(page, button("one"), "aria-expanded", "true");
  // (The page's chunks may already be fetched: the derived loader prefetches them at low priority after `load`.)
  assert.equal(await page.getAttribute(panel("one"), "hidden"), null);
  assert.equal(await page.getAttribute(".item-one", "data-expanded"), "true");
  await page.click(button("two"));
  await attr(page, button("two"), "aria-expanded", "true");
  assert.equal(await page.getAttribute(button("one"), "aria-expanded"), "false", "single mode closes the sibling");
  // Events fire in disclosure render order (one effect per disclosure), not Angular's dispatcher order
  // ("One opened, Two opened, One closed").
  await page.waitForFunction(() => document.querySelector("#log")?.textContent === "One opened, One closed, Two opened");
  await page.click(button("three"), { force: true });
  assert.equal(await page.getAttribute(button("three"), "aria-expanded"), "false", "disabled");
  await page.click("#open-all");
  assert.equal(await page.getAttribute(button("one"), "aria-expanded"), "false", "openAll: single mode no-op");
  await page.check("#multi");
  await page.click("#open-all");
  await attr(page, button("one"), "aria-expanded", "true");
  assert.equal(await page.getAttribute(button("two"), "aria-expanded"), "true");
  assert.equal(await page.getAttribute(button("three"), "aria-expanded"), "false");
  await page.click("#close-all");
  await attr(page, button("one"), "aria-expanded", "false");
  assert.equal(await page.getAttribute(button("two"), "aria-expanded"), "false");
  assert.equal(await componentRan(page), false);
  assert.deepEqual(seen.errors, []);
  await page.close();
});
