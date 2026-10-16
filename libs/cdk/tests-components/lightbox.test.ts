// Lightbox on a resumed page (story `/lightbox`): server markup (closed modal = overlay anchor only, inline lightbox
// server-rendered with its window), nothing boots at load, then the thumbnail button opens the modal at slide 2, keys /
// buttons navigate, the embed iframe mounts only once its slide is current, Escape closes and restores focus, and the
// inline lightbox navigates after resume.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("lightbox: server markup", async () => {
  const html = await (await fetch(s.origin + "/lightbox")).text();
  assert.doesNotMatch(html, /<div[^>]*data-lightbox-overlay/, "closed modal lightbox renders no overlay");
  assert.doesNotMatch(html, /<iframe/, "no embed iframe on the server");
  assert.match(html, /<section[^>]*data-lightbox-inline/);
  assert.equal((html.match(/data-lightbox-slide=""/g) ?? []).length, 3, "inline window: 3 slides");
  assert.match(html, /aria-label="1 of 3"/);
});

test("lightbox: nothing boots at load; opens at slide 2, navigates, mounts the embed lazily, Escape restores focus", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/lightbox");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator("script[data-boot]").count(), 0, "nothing boots at load");
  await page.click("#open-2");
  await page.waitForSelector("[data-lightbox-root] [data-lightbox-container]");
  const current = () => page.locator("[data-lightbox-root] [data-lightbox-slide][data-current]").getAttribute("data-index");
  await page.waitForFunction(() => !!document.activeElement?.closest("[data-lightbox-root]"));
  assert.equal(await current(), "1");
  assert.equal(await page.locator("[data-lightbox-root] [data-lightbox-counter]").textContent(), "2 / 4");
  assert.equal(await page.locator(".rv-LightboxCaptionsTitle").textContent(), "Green");
  assert.equal(await page.locator("[role=dialog]").getAttribute("aria-label"), "Gallery");
  assert.equal(await page.locator("iframe").count(), 0);
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector("[data-lightbox-root] [data-lightbox-slide][data-current]")?.getAttribute("data-index") === "2");
  assert.equal(await page.locator("#index").textContent(), "2", "controlled index written back");
  await page.click("[data-lightbox-root] [data-action=next]");
  await page.waitForSelector("iframe[src^='https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ']", { state: "attached" });
  await page.click("[data-lightbox-thumbnail][data-index='0']");
  await page.waitForFunction(() => document.querySelector("[data-lightbox-root] [data-lightbox-slide][data-current]")?.getAttribute("data-index") === "0");
  assert.equal(await page.locator("iframe").count(), 0, "leaving the embed unmounts it");
  await page.keyboard.press("Escape");
  await page.waitForSelector("[data-lightbox-overlay]", { state: "detached" });
  // FocusScope restores in the next animation frame (RA useRestoreFocus), after the overlay node left the page.
  await page.waitForFunction(() => document.activeElement?.id === "open-2");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("lightbox: inline lightbox navigates after resume", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/lightbox");
  await page.waitForLoadState("networkidle");
  await page.click("[data-lightbox-inline] [data-action=next]");
  await page.waitForFunction(() => document.querySelector("[data-lightbox-inline] [data-lightbox-slide][data-current]")?.getAttribute("data-index") === "1");
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector("[data-lightbox-inline] [data-lightbox-slide][data-current]")?.getAttribute("data-index") === "2");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
