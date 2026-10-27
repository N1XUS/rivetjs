// DatePicker opening keeps the page scroll (`/date-picker-scroll`, UI-BUGS 2026-10-27: ui-docs home "Book a demo" tile). The
// unpositioned popover was a static block: moved into a `PortalProvider` container above the viewport, it grew that container
// and scroll anchoring scrolled the page by the popover's height, cold (first click resumes the picker) and warm (second open).
// The body-portal picker on the same page is the control.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

for (const id of ["dps-portal", "dps-body"])
  test(`date picker: opening keeps scrollY, cold and warm (#${id})`, async () => {
    const page = await s.browser.newPage({ viewport: { width: 1200, height: 800 } });
    try {
      const seen = watch(page);
      await page.goto(s.origin + "/date-picker-scroll");
      await page.waitForLoadState("networkidle");
      await page.evaluate((id) => scrollBy(0, document.getElementById(id)!.getBoundingClientRect().top - 150), id);
      const trigger = `#${id} [data-slot=date-picker-trigger]`;
      for (const round of ["cold", "warm"]) {
        const before = await page.evaluate(() => scrollY);
        await page.click(trigger);
        await page.waitForSelector("[data-slot=date-picker-popover] [data-slot=calendar-cell]:focus");
        // Positioned below the trigger, in view (not scrolled to).
        await page.waitForFunction(() => (document.querySelector("[data-slot=date-picker-popover]") as HTMLElement).style.top !== "");
        assert.equal(await page.evaluate(() => scrollY), before, `${round} open scrolled the page`);
        const top = await page.$eval("[data-slot=date-picker-popover]", (el) => el.getBoundingClientRect().top);
        assert.ok(top > 150 && top < 800, `${round} popover in view (${top})`);
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => document.querySelector("[data-slot=date-picker-popover]") === null);
        assert.equal(await page.evaluate(() => scrollY), before, `${round} close scrolled the page`);
      }
      assert.deepEqual(seen.errors, []);
    } finally {
      await page.close();
    }
  });
