// Scheduler on a resumed page (story `/scheduler`): the month view boots nothing at load, its server HTML carries
// every visible chip and the `+N more` button; a cold press opens the panel (chips listed, `onMoreAction` once,
// focus inside) and Escape closes it without page errors. Story `/scheduler-zone` (no `timeZone`, browser in
// America/Los_Angeles): the resumed page keeps the server's UTC layout on its first recompute.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("scheduler month: final server HTML, nothing boots, cold +N more panel", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/scheduler");
  assert.equal(await page.locator("script[data-boot]").count(), 0, "nothing boots at load");
  assert.equal(await page.locator("#agenda .rv-SchedulerMonth-cell").count(), 42);
  assert.equal(await page.locator('#agenda [data-rv-event-id="span"]').count(), 1);
  const more = page.locator('#agenda [data-rv-day-index="8"] .rv-SchedulerMonth-more');
  assert.equal((await more.textContent())?.trim(), "+3 more");
  await more.click();
  await page.waitForSelector(".rv-SchedulerMonth-popover [data-rv-event-id='t4']");
  assert.equal(await page.locator(".rv-SchedulerMonth-popover [data-rv-event-id]").count(), 5);
  assert.equal(await page.textContent("#more-count"), "1");
  await page.waitForFunction(() => !!document.activeElement?.closest(".rv-SchedulerMonth-popover"));
  await page.keyboard.press("Escape");
  await page.waitForSelector(".rv-SchedulerMonth-popover", { state: "detached" });
  assert.equal(await more.getAttribute("aria-expanded"), "false");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("scheduler without timeZone: a resumed recompute keeps the server's zone (no chip jump, data-today stable)", async () => {
  const context = await s.browser.newContext({ timezoneId: "America/Los_Angeles" });
  const page = await context.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/scheduler-zone");
  const chip = page.locator('#zoned [data-rv-event-id="z"]');
  const top = () => chip.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--rv-scheduler-event-top"));
  const todayIndex = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll("#zoned .rv-SchedulerTimeGrid-day-header")).findIndex((el) => el.getAttribute("data-today") === "true"),
    );
  const before = await top();
  const today = await todayIndex();
  expect09(before);
  await page.click("#zone-refresh");
  await page.waitForTimeout(100);
  assert.equal(await chip.count(), 1);
  assert.equal(await top(), before, "09:00 UTC stays at 09:00 (the server's zone), not 01:00 / 02:00 Los Angeles");
  assert.equal(await todayIndex(), today);
  assert.deepEqual(seen.errors, []);
  await context.close();
});

/** Which loaded scripts carry the scheduler state (`state.ts`) / locale tables (`intl.ts`) code. */
async function heavyScripts(page: import("playwright").Page, scripts: readonly string[]): Promise<string[]> {
  return page.evaluate(async (urls) => {
    const out: string[] = [];
    for (const url of [...new Set(urls)]) {
      const text = await (await fetch(url)).text();
      if (text.includes("minTime must be earlier than maxTime")) out.push("state:" + url);
      if (text.includes("Aktionen f")) out.push("intl:" + url);
    }
    return out;
  }, scripts);
}

// KNOWN GAP (review T7+T8 #1, measured 2026-10-12, parked for T10): the first focus of a resumed month cell fetches
// ~74 scripts — the view handlers live in month.tsx / time-grid.tsx and capture the root context, whose arrows /
// computeds (index.tsx) and user closures pull the whole scheduler graph (state, intl, layout, menu, popover). The
// arrow / Escape / click after it fetch nothing new. `test.fails` flips red once the T10 handler split lands: drop it.
test.fails("scheduler month: a cold focus / arrow key / Escape / plain click loads no state or locale-table code", async () => {
  const page = await s.browser.newPage();
  try {
    // No deferred loading (idle boot / preload queue): what the input itself fetches is what it waits for.
    await page.addInitScript(() => {
      window.requestIdleCallback = (() => 0) as typeof window.requestIdleCallback;
      new MutationObserver((records) => {
        if (document.readyState === "loading") return;
        for (const record of records)
          for (const node of record.addedNodes)
            if ((node as Element).localName === "link" && (node as HTMLLinkElement).rel === "modulepreload") (node as Element).remove();
      }).observe(document, { childList: true, subtree: true });
    });
    const seen = watch(page);
    await page.goto(s.origin + "/scheduler");
    await page.waitForTimeout(300);
    const atLoad = seen.scripts.length;
    await page.evaluate(() => (document.querySelector('#agenda [data-rv-day-index="10"]') as HTMLElement).focus());
    await page.waitForTimeout(300);
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-rv-day-index") === "11");
    await page.keyboard.press("Escape");
    const cell = page.locator('#agenda [data-rv-day-index="16"]');
    const box = (await cell.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 4);
    await page.waitForTimeout(300);
    const loaded = seen.scripts.slice(atLoad);
    assert.deepEqual(await heavyScripts(page, loaded), []);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
});

/** 09:00 of a 00:00–24:00 axis = 37.5 %. */
function expect09(value: string): void {
  assert.equal(parseFloat(value), 37.5);
}
