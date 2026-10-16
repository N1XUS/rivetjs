// CELLSELECT-DEV (2026-10-08): the ui-docs "CellSelect: Usage" demo in a 300px-high viewport (the docs example frame) on
// the dev server: opening, keyboard and picking log no error. Was: the popover's first position was measured while its
// portal host still sat in place (a flex item of the CellSelect column: its gap moved the centred trigger 2px), the
// ResizeObserver re-positioned it inside its own callback, "ResizeObserver loop completed with undelivered
// notifications" (an ErrorEvent without `error`) reached the overlay as "Browser error: null".
import { test } from "vitest";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "playwright";

const root = new URL("./app/", import.meta.url).pathname;

test("dev server: CellSelect popover in a short viewport opens at its final position, no ResizeObserver loop", async () => {
  const saved = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  const server = await createServer({ root, configFile: root + "vite.config.ts", logLevel: "silent", server: { port: 0 } });
  await server.listen();
  const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 750, height: 300 } });
    await page.addInitScript(() => {
      // Window error events whose `error` is null (a ResizeObserver loop) never reach `pageerror`.
      addEventListener("error", (event) => console.error(`window error: ${event.message}`), true);
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    // Warm-up load: a cold Vite dependency optimization may reload the first page mid-test.
    await page.goto(origin + "/cell-select-dev");
    await page.waitForLoadState("networkidle");
    await page.reload();
    await page.waitForLoadState("networkidle");
    errors.length = 0;
    // The docs frame's geometry: trigger centred in 300px (the story layout's nav row scrolls away).
    await page.evaluate(() => scrollTo(0, document.querySelector(".cell-select__trigger")!.getBoundingClientRect().top - 128));
    const trigger = page.locator("#csd .cell-select__trigger");

    await trigger.click();
    await page.waitForSelector(".cell-select__popover [role=option]");
    await page.waitForTimeout(300);
    const at = await page.evaluate(() => ({
      trigger: document.querySelector(".cell-select__trigger")!.getBoundingClientRect().bottom,
      popover: parseFloat((document.querySelector(".cell-select__popover") as HTMLElement).style.top) - scrollY,
    }));
    assert.equal(at.popover, at.trigger + 8, JSON.stringify(at));
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#csd .cell-select__value")?.textContent === "Dark");
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    // Escape goes to the popover once the list has taken focus (as in RAC: the overlay owns the dismiss key).
    await page.waitForFunction(() => !!document.activeElement?.closest(".cell-select__popover"));
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector("#csd .cell-select__trigger")?.getAttribute("aria-expanded") === "false");
    await trigger.click();
    await page.locator(".cell-select__popover [role=option]").first().click();
    await page.waitForFunction(() => document.querySelector("#csd .cell-select__value")?.textContent === "Light");
    await page.waitForTimeout(300);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await server.close();
    if (saved === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved;
  }
});
