// FloatingToc on a resumed page (`/floating-toc`; Rivet addition, feature set inspired by HeroUI Pro's public Floating TOC
// docs): a cold hover opens the hover TOC after the delay, an item press sets the active section (bar + item data-active);
// the press TOC opens on a click and an item press closes it.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("floating toc: cold hover open, item press, press mode", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 900 } });
  await page.goto(s.origin + "/floating-toc");
  await page.waitForLoadState("networkidle");
  // Hover mode is a non-modal popover (no dialog role, so no `id`): select it by class.
  assert.equal(await page.locator(".floating-toc__content").count(), 0);
  await page.hover("#toc-hover");
  await page.waitForSelector(".floating-toc__content");
  await page.click("#h-config");
  await page.waitForFunction(() => document.querySelector("#toc-active")?.textContent === "config");
  assert.equal(await page.locator("#h-config").getAttribute("data-active"), "true");
  assert.equal(await page.locator("#toc-hover .floating-toc__bar:nth-child(3)").getAttribute("data-active"), "true");
  await page.mouse.move(900, 800);
  await page.waitForSelector(".floating-toc__content", { state: "detached" });
  await page.click("#toc-press");
  await page.waitForSelector("#toc-press-content");
  await page.click("#p-usage");
  await page.waitForFunction(() => document.querySelector("#toc-active")?.textContent === "usage");
  await page.waitForSelector("#toc-press-content", { state: "detached" });
  await page.close();
});
