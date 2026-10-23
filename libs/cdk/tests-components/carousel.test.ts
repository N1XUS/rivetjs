// Carousel on a resumed page (story `/carousel`): server markup (W3C APG roles / labels, startIndex transform,
// disabled previous button, tab list), no carousel code before interaction, then after resume: next / previous
// buttons, a cold mouse drag (first mousedown replayed into embla's DragHandler), arrow keys, dots, loop.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { among, chunksOf, stories, watch, type Stories } from "./harness.ts";

let s: Stories;
// Fetch-ahead on (`data-fo`): the "preloaded when visible" / cold-key checks expect the page's chunks fetched after load.
beforeAll(async () => (s = await stories({ preload: {} })));
afterAll(async () => s?.close());

type Page = import("playwright").Page;
// Container offset inside the viewport (server `translate` before the engine runs, embla `transform` after).
const offsetJs = (root: string) => {
  const viewport = document.querySelector(`${root} .rv-CarouselViewport`)!.getBoundingClientRect();
  return document.querySelector(`${root} .rv-CarouselContainer`)!.getBoundingClientRect().left - viewport.left;
};
const offsetX = (page: Page, root: string) => page.evaluate(offsetJs, root);
const settledAt = (page: Page, root: string, x: number) =>
  page.waitForFunction(
    ([root, x]) => {
      const viewport = document.querySelector(`${root} .rv-CarouselViewport`)!.getBoundingClientRect();
      return Math.abs(document.querySelector(`${root} .rv-CarouselContainer`)!.getBoundingClientRect().left - viewport.left - x) < 0.5;
    },
    [root, x] as const,
  );
// Slides are 302 px (300 px + 1 px borders), align center in a 300 px viewport: snap i at -1 - 302 * i.
const snap = (i: number) => -1 - 302 * i;

test("carousel: server markup", async () => {
  const html = await (await fetch(s.origin + "/carousel")).text();
  assert.match(html, /<div[^>]*role="region"[^>]*aria-roledescription="carousel"[^>]*aria-label="Basic"|aria-label="Basic"[^>]*role="region"/);
  assert.match(html, /role="group"[^>]*aria-roledescription="slide"[^>]*aria-label="2 of 5"|aria-label="2 of 5"[^>]*aria-roledescription="slide"/);
  // startIndex 1 before the engine runs: the container is translated by one slide size (CSS `translate`).
  assert.match(
    html,
    /class="rv-CarouselContainer"[^>]*style="[^"]*translate:calc\(1 \* \(\(\(100% - \(1 \* var\(--rv-carousel-slide-size, 100%\)\)\) \/ 2\) - 1 \* var\(--rv-carousel-slide-size, 100%\)\)\) 0px/,
  );
  assert.match(html, /role="tablist"/);
  assert.equal((html.match(/role="tab"/g) ?? []).length, 5);
  assert.match(html, /role="tabpanel"/);
});

test("carousel: SSR position and labels before interaction, engine not started", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/carousel");
  await page.waitForLoadState("networkidle");
  // The runtime's visible preload may fetch handler chunks; nothing runs: no engine, server styles in place.
  assert.equal(await page.locator("#basic").getAttribute("data-ready"), null, "engine not started before interaction");
  assert.equal(await page.locator("#basic .rv-CarouselContainer").evaluate((el) => (el as HTMLElement).style.transform), "");
  // `translate` percentages resolve against the container (300 px); the bordered slides are 302 px.
  assert.ok(Math.abs((await offsetX(page, "#basic")) + 300) < 1, "server translate shows the startIndex slide");
  assert.equal(await page.locator("#basic [aria-roledescription=slide]").nth(1).getAttribute("data-snapped"), "true");
  assert.equal(await page.locator("#basic-prev").isDisabled(), false);
  assert.equal(await page.locator("#tabbed [role=tab]").first().getAttribute("aria-selected"), "true");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("carousel: resumed — next / previous buttons scroll with embla's motion", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/carousel");
  await page.click("#basic-next");
  await page.waitForFunction(() => document.querySelector("#basic-selected")?.textContent === "2");
  await settledAt(page, "#basic", snap(2));
  assert.equal(await page.locator("#basic [aria-roledescription=slide]").nth(2).getAttribute("data-snapped"), "true");
  await page.click("#basic-prev");
  await page.waitForFunction(() => document.querySelector("#basic-selected")?.textContent === "1");
  await settledAt(page, "#basic", snap(1));
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("carousel: the first press needs no further chunk (root + viewport handler code preloaded when visible)", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/carousel");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator("script[data-boot]").count(), 0, "nothing boots at load");
  assert.equal(await page.locator("#basic").getAttribute("data-ready"), null, "engine not started before interaction");
  const before = seen.scripts.length;
  await page.click("#basic-next");
  await page.waitForFunction(() => document.querySelector("#basic-selected")?.textContent === "2");
  assert.deepEqual(
    // Any chunk holding resume symbols (`resume-…`, or a merged `rivet-merge-…` holding placed route-mode parts).
    among(seen.scripts.slice(before), chunksOf(/#/)),
    [],
    "chunks loaded by the first press",
  );
  assert.deepEqual(seen.errors, []);
  await page.close();
});

// The measured slow-network failure (150 ms RTT, 4x CPU: 3/3 cold clicks never selected): the Next button's own
// chunks were in, the Carousel root's `focusin` chunk was not — the press ran at pointerdown, the loader held the
// click behind the cold focusin replay, and RA's 80 ms "no click after pointerup" fallback cancelled the press
// before the held click reached it. Deterministic: the root chunk is held until well after the click.
// Chunks come from the build manifest: with `chunks: "component"` the root (`resume-Carousel-…`) and the Next button
// (`resume-CarouselNext-…`) are two files and the test replays the measured race (Next live, root cold); with the
// default route chunks one file holds both (same module), so holding it holds Next too and the click is fully cold.
test("carousel: a cold press whose click is held behind a loading chunk still selects", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  const root = chunksOf(/#Carousel$/);
  const nextOnly = [...chunksOf(/#CarouselNext$/)].filter((chunk) => !root.has(chunk));
  assert.ok(root.size > 0, "the Carousel root has resume symbols");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    (url) => root.has(url.pathname),
    async (route) => {
      await gate;
      await route.continue();
    },
  );
  const next = nextOnly.length ? page.waitForResponse((response) => nextOnly.includes(new URL(response.url()).pathname)) : null;
  await page.goto(s.origin + "/carousel");
  await next;
  // the visible-preloaded Button / CarouselNext chunks are evaluated in an idle slice
  await page.waitForTimeout(500);
  await page.click("#basic-next");
  await page.waitForTimeout(400);
  release();
  await page.waitForFunction(() => document.querySelector("#basic-selected")?.textContent === "2", null, { timeout: 10000 });
  await settledAt(page, "#basic", snap(2));
  assert.equal(await page.locator("#basic-next").getAttribute("data-pressed"), null);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("carousel: resumed — cold mouse drag snaps to the next slide", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/carousel");
  await page.waitForLoadState("networkidle");
  const box = (await page.locator("#basic .rv-CarouselViewport").boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 250, y);
  await page.mouse.down();
  await page.waitForFunction(() => document.querySelector("#basic")?.hasAttribute("data-dragging"));
  await page.mouse.move(box.x + 60, y, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector("#basic-selected")?.textContent === "2");
  await settledAt(page, "#basic", snap(2));
  assert.equal(await page.locator("#basic").getAttribute("data-dragging"), null);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("carousel: resumed — arrow keys on a focused control, dots tab list keys", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/carousel");
  await page.focus("#basic-next");
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector("#basic-selected")?.textContent === "2");
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => document.querySelector("#basic-selected")?.textContent === "1");

  const tabs = page.locator("#tabbed [role=tab]");
  await tabs.nth(0).focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.querySelectorAll("#tabbed [role=tab]")[1]?.getAttribute("aria-selected") === "true");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("role")), "tab");
  await settledAt(page, "#tabbed", snap(1));
  await page.keyboard.press("End");
  await page.waitForFunction(() => document.querySelectorAll("#tabbed [role=tab]")[4]?.getAttribute("aria-selected") === "true");
  await tabs.nth(2).click();
  await page.waitForFunction(() => document.querySelectorAll("#tabbed [role=tab]")[2]?.getAttribute("aria-selected") === "true");
  await settledAt(page, "#tabbed", snap(2));
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("carousel: resumed — loop wraps from the first slide to the last", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/carousel");
  assert.equal(await page.locator("#looped-prev").isDisabled(), false);
  await page.click("#looped-prev");
  await page.waitForFunction(() => document.querySelectorAll("#looped [aria-roledescription=slide]")[4]?.getAttribute("data-snapped") === "true");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
