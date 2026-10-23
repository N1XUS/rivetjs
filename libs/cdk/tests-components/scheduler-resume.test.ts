// Scheduler on a resumed page (story `/scheduler`): the month view boots nothing at load, its server HTML carries
// every visible chip and the `+N more` button; a cold press opens the panel (chips listed, `onMoreAction` once,
// focus inside) and Escape closes it without page errors. Story `/scheduler-zone` (no `timeZone`, browser in
// America/Los_Angeles): the resumed page keeps the server's UTC layout on its first recompute.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { brotliCompressSync } from "node:zlib";
import { dist } from "./app/serve.ts";
import { stories, watch, type Stories, scriptsOf } from "./harness.ts";

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

test("scheduler adopted week/day: date navigation updates the actual headers and slot labels", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  try {
    await page.goto(s.origin + "/scheduler-zone");
    await page.waitForLoadState("networkidle");
    const header = page.locator("#zoned .rv-SchedulerTimeGrid-day-header").first();
    const slot = page.locator("#zoned .rv-SchedulerTimeGrid-slot").first();
    const originalHeader = await header.getAttribute("aria-label");
    const originalSlot = await slot.getAttribute("aria-label");
    const today = await page.locator('#zoned .rv-SchedulerTimeGrid-day-header[data-today="true"]').getAttribute("aria-label");
    for (const view of ["week", "day"] as const) {
      if (view === "day") {
        await page.getByRole("radio", { name: "Day", exact: true }).click();
        await page.waitForFunction(() => document.querySelector("#zoned")?.getAttribute("data-view") === "day");
        assert.equal(await header.getAttribute("aria-label"), today);
      }
      const beforeHeader = await header.getAttribute("aria-label");
      const beforeSlot = await slot.getAttribute("aria-label");
      const title = await page.locator("#zoned .rv-SchedulerToolbar-title").textContent();
      await page.getByRole("button", { name: `Next ${view}`, exact: true }).click();
      await page.waitForFunction((before) => document.querySelector("#zoned .rv-SchedulerToolbar-title")?.textContent !== before, title);
      assert.notEqual(await header.getAttribute("aria-label"), beforeHeader, `${view} header follows date`);
      assert.notEqual(await slot.getAttribute("aria-label"), beforeSlot, `${view} slot follows date`);
      await page.getByRole("button", { name: `Previous ${view}`, exact: true }).click();
      await page.waitForFunction(
        (before) => document.querySelector("#zoned .rv-SchedulerTimeGrid-day-header")?.getAttribute("aria-label") === before,
        beforeHeader,
      );
      assert.equal(await slot.getAttribute("aria-label"), beforeSlot);
      await page.getByRole("button", { name: `Next ${view}`, exact: true }).click();
      await page.waitForFunction(
        (before) => document.querySelector("#zoned .rv-SchedulerTimeGrid-day-header")?.getAttribute("aria-label") !== before,
        beforeHeader,
      );
      await page.getByRole("button", { name: "Today", exact: true }).click();
      await page.waitForFunction(
        (before) => document.querySelector("#zoned .rv-SchedulerTimeGrid-day-header")?.getAttribute("aria-label") === before,
        beforeHeader,
      );
      assert.equal(await slot.getAttribute("aria-label"), beforeSlot);
    }
    assert.ok(originalHeader && originalSlot);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
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

// Derived resume adopts the ordinary component function. Its static closure includes state/intl; this is measured
// below, not hidden behind an expected failure. The historical leaf-only chunk budget remains unmet (§6 ruling).
test("scheduler month: cold focus / arrow key / Escape / plain click work without errors", async () => {
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
    assert.deepEqual(scriptsOf(seen.scripts, /scheduler/), [], "month loads no scheduler boundary before input");
    const atLoad = seen.scripts.length;
    await page.evaluate(() => (document.querySelector('#agenda [data-rv-day-index="10"]') as HTMLElement).focus());
    await page.waitForTimeout(300);
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-rv-day-index") === "11");
    await page.keyboard.press("Escape");
    const cell = page.locator('#agenda [data-rv-day-index="16"]');
    await cell.scrollIntoViewIfNeeded();
    const box = (await cell.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 4);
    await page.waitForTimeout(300);
    const loaded = seen.scripts.slice(atLoad);
    assert.equal(await page.textContent("#action-count"), "1");
    assert.equal(await page.locator("#agenda .rv-SchedulerMonth-cell").count(), 42);
    const heavy = await heavyScripts(page, loaded);
    const buffers = [...new Set(loaded)].map((path) => readFileSync(dist + "/client" + path));
    console.info(
      "scheduler cold adopted closure",
      JSON.stringify({
        scripts: buffers.length,
        raw: buffers.reduce((n, b) => n + b.length, 0),
        brotli: buffers.reduce((n, b) => n + brotliCompressSync(b).length, 0),
        heavy,
      }),
    );
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
});

test("scheduler month: first pointer drag commits and requests the lazy drag engine", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  try {
    await page.goto(s.origin + "/scheduler");
    await page.addStyleTag({
      content: `
      .rv-SchedulerMonth-weekdays,.rv-SchedulerMonth-row { display:flex }
      .rv-SchedulerMonth-weekday,.rv-SchedulerMonth-cell { width:120px;flex:none }
      .rv-SchedulerMonth-cell { height:90px;position:relative }
      .rv-SchedulerMonth-lanes { position:relative }
      .rv-SchedulerMonth-lanes>.rv-SchedulerEvent { position:absolute;top:calc((var(--rv-scheduler-lane) - 1)*20px);height:18px;width:calc(var(--rv-scheduler-span)*100%);background:#ddd }
    `,
    });
    const chip = page.locator('#agenda [data-rv-event-id="span"]');
    const box = (await chip.boundingBox())!;
    const target = (await page.locator('#agenda .rv-SchedulerMonth-cell[data-rv-day-index="10"]').boundingBox())!;
    const before = seen.scripts.length;
    await page.mouse.move(box.x + 20, box.y + 8);
    await page.mouse.down();
    // The first press must keep its timing while the gesture chunk loads.
    await page.waitForTimeout(200);
    await page.mouse.move(target.x + 20, target.y + 50, { steps: 12 });
    await page.waitForSelector("[data-rv-drag-clone]");
    await page.mouse.up();
    await page.waitForFunction(() => document.getElementById("move-count")?.textContent === "1");
    assert.equal(await page.textContent("#span-start"), "2031-03-06");
    assert.ok(
      seen.scripts.slice(before).some((url) => /\/drag-/.test(url)),
      "drag engine is fetched on the first press",
    );
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
});

test("scheduler month: cold context menu opens, activates once and returns focus", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  try {
    await page.goto(s.origin + "/scheduler");
    const cell = page.locator('#agenda .rv-SchedulerMonth-cell[data-rv-day-index="10"]');
    await cell.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Create event" }).click();
    await page.waitForFunction(() => document.getElementById("menu-count")?.textContent === "1");
    await page.waitForSelector('[role="menu"]', { state: "detached" });
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-rv-day-index") === "10");
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
});

/** 09:00 of a 00:00–24:00 axis = 37.5 %. */
function expect09(value: string): void {
  assert.equal(parseFloat(value), 37.5);
}
