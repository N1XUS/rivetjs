// Masonry / Bento — resumed story app (`/masonry`; Rivet addition, behaviour `@rivetjs/cdk/masonry`): SSR markup (ui
// classes over the cdk markup, inline placement), HeroUI-look item radius + selected ring, nothing boots at load; after
// resume a click selects (ring + count), arrows move focus with the focus ring, Bento Enter runs the action.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("masonry: SSR markup", async () => {
  const html = await (await fetch(s.origin + "/masonry")).text();
  assert.match(html, /class="masonry max-w-\[720px\]"/);
  assert.equal((html.match(/class="masonry__item"/g) ?? []).length, 10);
  assert.equal((html.match(/class="bento__item"/g) ?? []).length, 5);
  assert.match(html, /data-layout="dense"/);
});

test("masonry: looks, selection, keys and action after resume; nothing boots", async () => {
  const page = await s.browser.newPage({ viewport: { width: 900, height: 1200 } });
  const seen = watch(page);
  await page.goto(s.origin + "/masonry");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator("script[data-boot]").count(), 0, "nothing boots at load");
  const radius = await page.locator('#gallery [data-key="ph0"]').evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
  assert.ok(radius > 8, `item radius ${radius}`);
  await page.click('#gallery [data-key="ph2"]');
  await page.waitForFunction(() => document.querySelector("#sel")?.textContent === "1");
  const ring = await page.locator('#gallery [data-key="ph2"]').evaluate((el) => getComputedStyle(el).boxShadow);
  assert.notEqual(ring, "none", "selected ring");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.key), "ph1");
  await page.focus('#feed [data-key="t-revenue"]');
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.key), "t-users");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#act")?.textContent === "t-users");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
