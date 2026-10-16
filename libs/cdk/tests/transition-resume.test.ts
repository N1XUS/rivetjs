// @rivetjs/kit <Transition> on a resumed page (production build): no JavaScript until `show` changes,
// enter / leave phases and unmount after the transition, nested children, no component runs.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, componentRan, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("transition: zero JS at load; enter, leave and unmount after a click; nested leave waits for the child", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/transition");
  assert.equal(await page.$("#panel"), null, "starts hidden: not rendered");
  assert.equal(await page.getAttribute("#outer", "class"), "", "starts shown: settled classes");
  await page.waitForTimeout(300);
  const atLoad = [...seen.scripts];
  await page.click("#toggle");
  await page.waitForFunction(() => document.querySelector("#panel")?.className === "fade to");
  assert.ok(seen.scripts.length > atLoad.length, "code loads when `show` changes");
  await page.waitForFunction(() => document.querySelector("#panel")?.className === "done");
  assert.equal(await page.getAttribute("#panel", "data-transition"), null);
  await page.click("#toggle");
  await page.waitForFunction(() => document.querySelector("#panel")?.className === "fade from");
  assert.equal(await page.getAttribute("#panel", "data-closed"), "");
  await page.waitForFunction(() => document.querySelector("#panel") === null);
  await page.click("#toggle-nested");
  await page.waitForFunction(() => document.querySelector("#inner")?.className === "slow from");
  await page.waitForTimeout(150);
  assert.notEqual(await page.$("#outer"), null, "outer waits for the slower child");
  await page.waitForFunction(() => document.querySelector("#outer") === null);
  assert.equal(await componentRan(page), false);
  assert.deepEqual(seen.errors, []);
  await page.close();
});
