// Repro: a second `_regionState` created after one that nests another `_regionState` (component
// body) — after resume, a click handler writes its signal; the bindings reading it must update.
// Case "flat" is the control (no nested `_regionState` in the first state).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const text = (page: Page, id: string) => page.evaluate((id) => document.getElementById(id)?.textContent ?? null, id);
/** Text of `id` after the binding flush (up to 1 s), or what it is then. */
async function settled(page: Page, id: string, value: string): Promise<string | null> {
  await page.waitForFunction(([id, value]) => document.getElementById(id!)?.textContent === value, [id, value] as const, { timeout: 1000 }).catch(() => {});
  return text(page, id);
}

for (const id of ["flat", "nested", "linked"]) {
  test(`region state (${id}): handler write of the second _regionState updates its bindings`, async () => {
    const page = await s.browser.newPage();
    const seen = watch(page);
    await page.goto(s.origin + "/region-state-repro");
    assert.equal(await text(page, id + "-text"), "0");
    await page.click(`#${id}-bump`);
    assert.equal(await settled(page, id + "-text", "1"), "1");
    assert.equal(await settled(page, id + "-row", "1"), "1");
    await page.click(`#${id}-bump`);
    assert.equal(await settled(page, id + "-text", "2"), "2");
    assert.deepEqual(seen.errors, []);
    await page.close();
  });
}
