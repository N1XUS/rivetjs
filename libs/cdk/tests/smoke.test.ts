// cdk story app smoke: the production build serves resumed pages with no library JS before input.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, libraryScripts, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("story app: index renders, no library code before interaction", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/");
  assert.equal(await page.textContent("h1"), "Rivet cdk stories");
  assert.deepEqual(libraryScripts(seen), []);
  assert.deepEqual(seen.errors, []);
  await page.close();
});
