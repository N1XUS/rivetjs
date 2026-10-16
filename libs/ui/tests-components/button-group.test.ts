// ButtonGroup edge radii / AvatarGroup overlap + clip mask with a cdk overlay anchor (`span[data-rv-overlay-anchor]`) next to the trigger (Dropdown, Tooltip).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("button-group: first / last .button keep rounded edges when an overlay anchor follows the trigger", async () => {
  const page = await s.browser.newPage();
  try {
    const seen = watch(page);
    await page.goto(s.origin + "/button-group");
    const radii = (id: string) =>
      page.$eval(id, (el) => {
        const style = getComputedStyle(el);
        return [style.borderStartStartRadius, style.borderStartEndRadius, style.borderEndEndRadius, style.borderEndStartRadius].map((v) => parseFloat(v) > 0);
      });
    // The overlay anchors are really there (the regression's precondition).
    assert.equal(await page.$eval("#bg-dropdown", (el) => el.lastElementChild?.hasAttribute("data-rv-overlay-anchor")), true);
    assert.equal(await page.$eval("#bg-first", (el) => el.nextElementSibling?.hasAttribute("data-rv-overlay-anchor")), true);
    // [start-start, start-end, end-end, end-start] (LTR horizontal: start-start = top-left, start-end = top-right).
    assert.deepEqual(await radii("#bg-merge"), [true, false, false, true]);
    assert.deepEqual(await radii("#bg-more"), [false, true, true, false]);
    assert.deepEqual(await radii("#bg-first"), [true, false, false, true]);
    assert.deepEqual(await radii("#bg-middle"), [false, false, false, false]);
    assert.deepEqual(await radii("#bg-last"), [false, true, true, false]);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
});

test("avatar-group: Tooltip-wrapped avatars keep the overlap and the last one is not clipped", async () => {
  const page = await s.browser.newPage();
  try {
    const seen = watch(page);
    await page.goto(s.origin + "/button-group");
    assert.equal(await page.$eval("#ag-a", (el) => el.nextElementSibling?.hasAttribute("data-rv-overlay-anchor")), true);
    const style = (id: string) => page.$eval(id, (el) => ({ margin: getComputedStyle(el).marginInlineStart, mask: getComputedStyle(el).maskImage }));
    const [a, b, c] = [await style("#ag-a"), await style("#ag-b"), await style("#ag-c")];
    assert.equal(a.margin, "0px");
    assert.match(b.margin, /^-/);
    assert.match(c.margin, /^-/);
    assert.match(a.mask, /radial-gradient/);
    assert.match(b.mask, /radial-gradient/);
    assert.equal(c.mask, "none");
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
});
