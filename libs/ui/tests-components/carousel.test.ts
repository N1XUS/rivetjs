// Carousel — resumed story app (`/carousel`): SSR markup (BEM classes, APG roles, HeroUI icon-only controls, counter), HeroUI CSS
// applied (viewport radius, overlay control surface, active dot pill), no engine before the first interaction, then after resume:
// next / previous buttons + counter + dots follow, cold mouse drag (embla motion, no CSS transition on the track), dot click,
// autoplay advances on its own, pauses on hover and resumes on leave, rotation control stops it (play icon shown), thumbnails +
// outside controls.
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

const text = (page: Page, selector: string) => page.textContent(selector);
const selectedTab = (page: Page, root: string) =>
  page.evaluate((root) => [...document.querySelectorAll(`${root} [role=tab]`)].findIndex((t) => t.getAttribute("aria-selected") === "true"), root);
/** Track offset inside the viewport (embla transform). */
const offsetX = (page: Page, root: string) =>
  page.evaluate((root) => {
    const viewport = document.querySelector(`${root} .carousel__viewport`)!.getBoundingClientRect();
    return document.querySelector(`${root} .carousel__content`)!.getBoundingClientRect().left - viewport.left;
  }, root);

test("carousel: SSR markup — classes, APG roles, controls, counter", async () => {
  const html = await (await fetch(s.origin + "/carousel")).text();
  assert.match(
    html,
    /id="ca-basic"[^>]*role="region"[^>]*aria-roledescription="carousel"[^>]*aria-label="Basic"[^>]*class="carousel carousel--horizontal carousel--inside carousel--md w-80"/,
  );
  assert.match(html, /class="carousel__viewport"/);
  assert.match(html, /class="carousel__content"/);
  assert.match(html, /aria-label="Choose slide to display"/);
  assert.match(html, /id="ca-prev"[^>]*disabled[^>]*class="button button--icon-only button--md button--tertiary carousel__control carousel__previous"/);
  assert.match(html, /id="ca-next"[^>]*class="button button--icon-only button--md button--tertiary carousel__control carousel__next"/);
  assert.match(
    html,
    /id="ca-counter" class="carousel__counter" data-slot="carousel-counter"(?: data-b="\d+")?>(<!--[^>]*-->)*1(<!--[^>]*-->)* \/ (<!--[^>]*-->)*5/,
  );
  assert.match(html, /class="carousel carousel--horizontal carousel--outside carousel--md w-96"/);
  assert.equal((html.match(/class="carousel__thumbnail"/g) ?? []).length, 5);
  const rotation = /<button[^>]*id="ca-rotation"[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(rotation, /aria-label="Stop automatic slide show"/);
  assert.match(rotation, /data-rotating="true"/);
});

test("carousel: HeroUI CSS applied; no engine before interaction on the static carousels", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/carousel");
    await page.waitForLoadState("networkidle");
    assert.equal(await page.getAttribute("#ca-basic", "data-ready"), null, "engine not started before interaction");
    assert.equal(await page.getAttribute("#ca-thumbs", "data-ready"), null);
    const css = await page.evaluate(() => {
      const viewport = getComputedStyle(document.querySelector("#ca-basic .carousel__viewport")!);
      const next = getComputedStyle(document.querySelector("#ca-next")!);
      const prev = getComputedStyle(document.querySelector("#ca-prev")!);
      const dots = [...document.querySelectorAll("#ca-basic .carousel__dot")].map((d) => d.getBoundingClientRect().width);
      const track = getComputedStyle(document.querySelector("#ca-basic .carousel__content")!);
      return {
        radius: viewport.borderTopLeftRadius,
        nextBg: next.backgroundColor,
        nextShadow: next.boxShadow,
        prevOpacity: prev.opacity,
        dots,
        trackTransition: track.transitionProperty,
      };
    });
    assert.notEqual(css.radius, "0px");
    assert.notEqual(css.nextBg, "rgba(0, 0, 0, 0)", "inside controls sit on the overlay surface");
    assert.notEqual(css.nextShadow, "none");
    assert.equal(css.prevOpacity, "0", "no previous snap: the inside control fades out");
    assert.ok(css.dots[0]! > css.dots[1]! * 2, `active dot is a pill: ${css.dots.join(", ")}`);
    assert.ok(/^(all|none)$/.test(css.trackTransition) || !/transform|translate/.test(css.trackTransition), "no CSS transition on the track");
    assert.deepEqual(seen.errors, []);
  }));

test("carousel: resumed — next / previous move with embla's motion; counter + dots follow", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/carousel");
    const before = await offsetX(page, "#ca-basic");
    await page.click("#ca-next");
    await page.waitForFunction(() => document.querySelector("#ca-selected")?.textContent === "1");
    await page.waitForFunction(() => document.querySelector("#ca-counter")?.textContent === "2 / 5");
    assert.equal(await selectedTab(page, "#ca-basic"), 1);
    // Mid-animation the track sits between the two snaps (embla ScrollBody), then settles one slide further.
    await page.waitForFunction(() => document.querySelector("#ca-basic")?.getAttribute("data-ready") === "true");
    await page.waitForFunction((x) => {
      const viewport = document.querySelector("#ca-basic .carousel__viewport")!.getBoundingClientRect();
      const now = document.querySelector("#ca-basic .carousel__content")!.getBoundingClientRect().left - viewport.left;
      return Math.abs(now - (x - viewport.width)) < 1;
    }, before);
    assert.equal(await page.$eval("#ca-prev", (el) => getComputedStyle(el).opacity), "1");
    await page.click("#ca-prev");
    await page.waitForFunction(() => document.querySelector("#ca-counter")?.textContent === "1 / 5");
    assert.deepEqual(seen.errors, []);
  }));

test("carousel: resumed — cold mouse drag snaps to the next slide; dot click selects", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/carousel");
    await page.waitForLoadState("networkidle");
    const box = (await page.locator("#ca-basic .carousel__viewport").boundingBox())!;
    const y = box.y + box.height / 2;
    // Away from the inside controls (they overlay the viewport edges).
    await page.mouse.move(box.x + box.width * 0.6, y);
    await page.mouse.down();
    await page.waitForFunction(() => document.querySelector("#ca-basic")?.hasAttribute("data-dragging"));
    await page.mouse.move(box.x + 60, y, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector("#ca-counter")?.textContent === "2 / 5");
    assert.equal(await page.getAttribute("#ca-basic", "data-dragging"), null);
    await page.locator("#ca-basic [role=tab]").nth(4).click();
    await page.waitForFunction(() => document.querySelector("#ca-counter")?.textContent === "5 / 5");
    assert.equal(await selectedTab(page, "#ca-basic"), 4);
    assert.deepEqual(seen.errors, []);
  }));

test("carousel: resumed — autoplay advances, pauses on hover, resumes on leave; rotation control stops it", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/carousel");
    await page.waitForFunction(() => document.querySelector("#ca-auto")?.getAttribute("data-playing") === "true", null, { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector("#ca-auto-selected")?.textContent === "1", null, { timeout: 5000 });
    // Hover (APG): the whole carousel pauses.
    await page.hover("#ca-auto .carousel__viewport");
    await page.waitForFunction(() => !document.querySelector("#ca-auto")?.hasAttribute("data-playing"));
    const paused = await text(page, "#ca-auto-selected");
    await page.waitForTimeout(2000);
    assert.equal(await text(page, "#ca-auto-selected"), paused, "no advance while hovered");
    await page.mouse.move(5, 5);
    await page.waitForFunction(() => document.querySelector("#ca-auto")?.getAttribute("data-playing") === "true");
    // Rotation control: stop; the play icon shows, the pause icon hides.
    await page.click("#ca-rotation");
    await page.waitForFunction(() => document.querySelector("#ca-rotation")?.getAttribute("aria-label") === "Start automatic slide show");
    await page.mouse.move(5, 5);
    assert.equal(await page.getAttribute("#ca-rotation", "data-rotating"), null);
    assert.equal(await page.getAttribute("#ca-auto", "data-playing"), null);
    const icons = await page.evaluate(() => ({
      pause: getComputedStyle(document.querySelector('#ca-rotation [data-slot="carousel-pause-icon"]')!).display,
      play: getComputedStyle(document.querySelector('#ca-rotation [data-slot="carousel-play-icon"]')!).display,
    }));
    assert.deepEqual(icons, { pause: "none", play: "block" });
    const stopped = await text(page, "#ca-auto-selected");
    await page.waitForTimeout(2000);
    assert.equal(await text(page, "#ca-auto-selected"), stopped, "stopped: no advance");
    assert.deepEqual(seen.errors, []);
  }));

test("carousel: resumed — thumbnails select their slide; outside controls beside the viewport", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/carousel");
    const [prev, viewport, next] = await Promise.all(
      ["#ca-thumbs-prev", "#ca-thumbs .carousel__viewport", "#ca-thumbs-next"].map((sel) => page.locator(sel).boundingBox()),
    );
    assert.ok(prev!.x + prev!.width <= viewport!.x, "previous left of the viewport");
    assert.ok(next!.x >= viewport!.x + viewport!.width, "next right of the viewport");
    await page.locator("#ca-thumbs [role=tab]").nth(3).click();
    await page.waitForFunction(() => document.querySelectorAll("#ca-thumbs [role=tab]")[3]?.getAttribute("aria-selected") === "true");
    assert.equal(await page.locator("#ca-thumbs [aria-roledescription=slide]").nth(3).getAttribute("data-snapped"), "true");
    const ring = await page.$eval("#ca-thumbs [role=tab][aria-selected=true]", (el) => getComputedStyle(el).boxShadow);
    assert.notEqual(ring, "none");
    assert.deepEqual(seen.errors, []);
  }));
