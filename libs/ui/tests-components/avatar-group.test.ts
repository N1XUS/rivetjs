// AvatarGroup — resumed story app (`/avatar-group`): SSR markup (group classes, inherited size / color / variant, `max` truncation,
// automatic `+N`, explicit Count), CSS applied; a resumed `max` change recomputes the visible set and the `+N` text (group root kept;
// the first change re-creates the group's server-recorded children region (`<!--r…[-->` around the avatars), later changes keep the
// avatars, as client-rendered groups do, `../tests/avatar-group.test.tsx`).
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

const mark = (page: Page, selector: string) => page.$eval(selector, (el) => void ((el as unknown as Record<string, boolean>).__rvMark = true));
const marked = (page: Page, selector: string) => page.$eval(selector, (el) => (el as unknown as Record<string, boolean>).__rvMark === true);
const fallbacks = (page: Page, group: string) => page.$$eval(`${group} [data-slot=avatar-fallback]`, (els) => els.map((e) => e.textContent?.trim() ?? ""));
const waitFallbacks = (page: Page, group: string, want: string[]) =>
  page.waitForFunction(
    ([g, w]) => JSON.stringify(Array.from(document.querySelectorAll(`${g} [data-slot=avatar-fallback]`)).map((e) => e.textContent?.trim() ?? "")) === w,
    [group, JSON.stringify(want)] as const,
  );

test("avatar-group: SSR markup — classes, inherited props, max + automatic +N, explicit Count, CSS applied", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/avatar-group");
    assert.equal(await page.getAttribute("#ag", "data-slot"), "avatar-group");
    assert.match((await page.getAttribute("#ag", "class")) ?? "", /avatar-group/);
    assert.deepEqual(await fallbacks(page, "#ag"), ["A", "B", "+2"]);
    assert.equal(await page.textContent("#ag [data-slot=avatar-group-count]"), "+2");
    assert.deepEqual(await fallbacks(page, "#ag-sized"), ["X", "Y", "+1"]);
    const roots = await page.$$eval("#ag-sized > *", (els) => els.map((e) => e.className));
    assert.equal(roots.length, 3);
    for (const cls of roots) {
      assert.match(cls, /avatar--lg/);
      assert.match(cls, /avatar--soft/);
    }
    for (const cls of await page.$$eval("#ag-sized [data-slot=avatar-fallback]", (els) => els.map((e) => e.className)))
      assert.match(cls, /avatar__fallback--accent/);
    assert.deepEqual(await fallbacks(page, "#ag-count"), ["P", "+9"]);
    assert.equal(await page.$$eval("#ag-count [data-slot=avatar-group-count]", (els) => els.length), 1);
    assert.notEqual(await page.$eval("#ag-a", (el) => getComputedStyle(el).width), "auto");
    await page.waitForLoadState("networkidle");
    assert.deepEqual(seen.errors, []);
  }));

test("avatar-group: a resumed max change recomputes the visible set and the +N text (group root kept)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/avatar-group");
    await page.click("#ag-more");
    await waitFallbacks(page, "#ag", ["A", "B", "C", "+1"]);
    await mark(page, "#ag");
    await page.click("#ag-more");
    await waitFallbacks(page, "#ag", ["A", "B", "C", "D"]);
    assert.equal(await page.$$eval("#ag [data-slot=avatar-group-count]", (els) => els.length), 0);
    for (const step of [
      ["A", "B", "C", "+1"],
      ["A", "B", "+2"],
      ["A", "+3"],
      ["A", "+3"],
    ]) {
      await page.click("#ag-less");
      await waitFallbacks(page, "#ag", step);
      assert.equal(await page.textContent("#ag [data-slot=avatar-group-count]"), step.at(-1));
    }
    await page.click("#ag-more");
    await page.click("#ag-more");
    await waitFallbacks(page, "#ag", ["A", "B", "C", "+1"]);
    assert.ok(await marked(page, "#ag"), "group kept");
    assert.deepEqual(seen.errors, []);
  }));

// Review I3 (fixed 2026-10-08, runtime `dom-v2.ts` `cells`): the re-created children slot (`{freshChildren(…)}` next to the count's
// function child) returned the children thunk from its cell, which the array binding then called inside its own effect — every
// Show update re-created every Avatar. The first `max` change still re-creates the group's children region (the count `Show`'s
// condition reads `max` there); from the second change the avatars keep their nodes.
test("avatar-group: second resumed max change keeps the avatars A / B (nodes) [LIVE-PROPS P4]", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/avatar-group");
    await page.click("#ag-more");
    await waitFallbacks(page, "#ag", ["A", "B", "C", "+1"]);
    await mark(page, "#ag-a");
    await mark(page, "#ag-b");
    await page.click("#ag-more");
    await waitFallbacks(page, "#ag", ["A", "B", "C", "D"]);
    assert.ok(await marked(page, "#ag-a"), "avatar A kept");
    assert.ok(await marked(page, "#ag-b"), "avatar B kept");
  }));
