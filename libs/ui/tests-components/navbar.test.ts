// Navbar — resumed story app (`/navbar`; Rivet-authored, feature set inspired by HeroUI Pro's public Navbar docs): SSR markup
// with no runtime boot at load (no `data-boot`, nothing run before interaction); zero-JS hide on scroll (CSS scroll-state
// query: down hides, up reveals); menu toggle on a resumed page (aria-expanded, scroll lock, Escape restores focus to the
// toggle, MenuItem press closes); after the first interaction the lazy JS scroll listener owns `data-hidden`; the first
// press on a slow network is not a round trip (`preload="visible"` prefetched the chunks).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
// Fetch-ahead on (`data-fo`): the checks below measure what it preloads.
beforeAll(async () => (s = await stories({ preload: {} })));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>, width = 1000): Promise<void> {
  const page = await s.browser.newPage({ viewport: { width, height: 700 } });
  try {
    await body(page);
  } finally {
    await page.close();
  }
}

const navTop = (page: Page) => page.evaluate(() => document.getElementById("nb")!.getBoundingClientRect().bottom);
const menuShown = (page: Page) => page.evaluate(() => getComputedStyle(document.querySelector("[data-slot=navbar-menu]")!).display !== "none");

test("navbar: SSR markup, no runtime boot at load", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/navbar");
    assert.equal(await page.getAttribute("#nb", "class"), "navbar navbar--sticky");
    assert.equal(await page.getAttribute("#nb", "data-hide-on-scroll"), "true");
    assert.equal(await page.getAttribute("#nb-toggle", "aria-expanded"), "false");
    assert.equal(await page.getAttribute("#nb-docs", "aria-current"), "page");
    assert.equal(await page.locator("script[data-boot]").count(), 0, "no runtime boot at load");
    assert.equal(await menuShown(page), false);
    await page.waitForLoadState("networkidle");
    assert.deepEqual(seen.errors, []);
  }));

test("navbar: zero-JS hide on scroll (CSS scroll-state): down hides, up reveals", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/navbar");
    await page.waitForLoadState("networkidle");
    assert.ok((await navTop(page)) > 0);
    // A user scroll (scroll-state `scrolled` follows user scrolls; a wheel is not a runtime-starting interaction).
    await page.mouse.move(500, 400);
    await page.mouse.wheel(0, 800);
    await page.waitForFunction(() => document.getElementById("nb")!.getBoundingClientRect().bottom <= 0, undefined, { timeout: 3000 });
    assert.equal(await page.getAttribute("#nb", "data-hide-mode"), null, "no JS ran");
    await page.mouse.wheel(0, -300);
    await page.waitForFunction(() => document.getElementById("nb")!.getBoundingClientRect().top >= 0, undefined, { timeout: 3000 });
  }));

test("navbar menu on a resumed page: toggle, scroll lock, Escape restores focus, MenuItem closes", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/navbar");
    await page.click("#nb-toggle");
    await page.waitForFunction(() => document.getElementById("nb-toggle")!.getAttribute("aria-expanded") === "true");
    assert.equal(await menuShown(page), true);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), "hidden");
    assert.equal(await page.textContent("#nb-state"), "true");
    await page.focus("#nb-menu-blog");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.getElementById("nb-toggle")!.getAttribute("aria-expanded") === "false");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "nb-toggle");
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), "visible");
    await page.click("#nb-toggle");
    await page.waitForFunction(() => document.getElementById("nb")!.getAttribute("data-menu-open") === "true");
    await page.click("#nb-menu-blog");
    await page.waitForFunction(() => !document.getElementById("nb")!.hasAttribute("data-menu-open"));
    assert.equal(await page.textContent("#nb-state"), "false");
    await page.click("#nb-action");
    await page.waitForFunction(() => document.getElementById("nb-pressed")!.textContent === "1");
    assert.deepEqual(seen.errors, []);
  }));

test("navbar: after the first interaction the lazy JS scroll listener drives data-hidden", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/navbar");
    // The `interaction` trigger registers once the page resumed (idle); a press before that arms it on the next one.
    await page.waitForLoadState("networkidle");
    await page.click("#nb-action");
    await page.waitForFunction(() => document.getElementById("nb-pressed")!.textContent === "1");
    // The listener attaches once the runtime started (its chunk loads on the first scroll event).
    await page.waitForTimeout(300);
    await page.mouse.move(500, 400);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(300);
    await page.mouse.wheel(0, 600);
    await page.waitForFunction(() => document.getElementById("nb")!.getAttribute("data-hidden") === "true", undefined, { timeout: 3000 });
    assert.equal(await page.getAttribute("#nb", "data-hide-mode"), "js");
    await page.mouse.wheel(0, -300);
    await page.waitForFunction(() => !document.getElementById("nb")!.hasAttribute("data-hidden"), undefined, { timeout: 5000 });
  }));

test("navbar: first press on a slow network is fast (handler chunks prefetched while visible)", () =>
  onPage(async (page) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: 50_000, uploadThroughput: 50_000 });
    await page.goto(s.origin + "/navbar");
    await page.waitForLoadState("networkidle");
    const start = Date.now();
    await page.click("#nb-toggle");
    await page.waitForFunction(() => document.getElementById("nb-toggle")!.getAttribute("aria-expanded") === "true");
    const took = Date.now() - start;
    assert.ok(took < 350, `first press took ${took} ms (latency 400 ms)`);
  }, 600));
