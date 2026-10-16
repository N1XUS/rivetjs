// Avatar — resumed story app: SSR = fallback only; the image loads and swaps in without a user event; error keeps the fallback;
// `delayMs` fallback appears after the timer; an accessor `src` re-probes on change (resumed signal → fallback → image again).
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

test("avatar: SSR markup is the fallback only (no img), slot classes applied", () =>
  onPage(async (page) => {
    // Raw server HTML (before any script runs).
    const res = await page.request.get(s.origin + "/avatar");
    const html = await res.text();
    assert.ok(!/<img/.test(html), "no <img> in the server markup");
    assert.match(html, /id="a-ok-fb"[^>]*>OK</);
    // The element only: its props (id included) are in the resume state, which renders it on the client later.
    assert.ok(!/id="a-delay-fb"/.test(html), "delayed fallback is not server-rendered");
    assert.match(html, /class="avatar avatar--lg"/);
  }));

test("avatar: resumed page loads the image without a user event (clientEffect), error keeps the fallback, delayMs fallback appears", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/avatar");
    await page.waitForSelector("#a-ok-img", { timeout: 10000 });
    assert.equal(await page.getAttribute("#a-ok-img", "class"), "avatar__image");
    assert.equal(await page.$("#a-ok-fb"), null, "fallback removed once the image loaded");
    // Broken image: still the fallback, never an <img>.
    await page.waitForSelector("#a-delay-fb", { timeout: 10000 });
    assert.equal(await page.$("#a-bad-img"), null);
    assert.equal(await page.textContent("#a-bad-fb"), "BD");
    assert.equal(await page.textContent("#a-delay-fb"), "DL");
    assert.deepEqual(
      seen.errors.filter((e) => !/missing-avatar|404|Failed to load resource/.test(e)),
      [],
    );
  }));

test("avatar: accessor src on a resumed page re-probes on change (fallback while broken, image again after restore)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/avatar");
    await page.waitForSelector("#a-swap-img", { timeout: 10000 });
    assert.equal(await page.$("#a-swap-fb"), null);
    await page.click("#a-swap-bad");
    // Broken src: the img unmounts, the fallback is back (first-click flush is deferred one task).
    await page.waitForFunction(() => document.querySelector("#a-swap-img") === null && document.querySelector("#a-swap-fb")?.textContent === "SW", null, {
      timeout: 10000,
    });
    await page.click("#a-swap-ok");
    await page.waitForSelector("#a-swap-img", { timeout: 10000 });
    assert.equal(await page.$("#a-swap-fb"), null);
    assert.deepEqual(
      seen.errors.filter((e) => !/missing-avatar|404|Failed to load resource/.test(e)),
      [],
    );
  }));
