// Resumed interaction hooks in Chromium (story app, production build): the `/press` story smoke test
// (hover / move / outside / focus-scope stories exist under tests/app but are not driven here yet).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, errors, text, activeId, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("smoke: press story resumes", async () => {
  const page = await s.browser.newPage();
  const errs = errors(page);
  await page.goto(s.origin + "/press");
  await page.click("#target");
  await page.waitForFunction(() => document.querySelector("#log")?.textContent?.includes("press:mouse"));
  console.log(await text(page, "#log"));
  await page.focus("#target");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#log")?.textContent?.includes("press:keyboard"));
  console.log(await text(page, "#log"));
  assert.deepEqual(errs, []);
  await page.close();
});
