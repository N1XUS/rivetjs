// Lightbox — resumed story app (`/lightbox`): SSR (closed modal = overlay anchor only, inline BEM + HeroUI icon-only controls),
// nothing boots at load, then after resume: `#lb-open` opens at slide 2 with the HeroUI CSS (fixed blur backdrop, dark icon
// buttons, counter pill, captions gradient), ArrowRight / Next advance (counter + `#lb-index` follow), a thumbnail jumps, the
// captions toggle hides the captions, Escape closes and restores focus to `#lb-open`; inline Next works after resume.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage();
  try {
    await page.goto(s.origin + "/lightbox");
    await body(page);
  } finally {
    await page.close();
  }
}

const root = "[data-lightbox-root]";
const counter = (page: Page) => page.textContent(`${root} .lightbox__counter`);

test("lightbox: SSR — closed modal renders no slides; inline markup with classes", async () => {
  const html = await (await fetch(s.origin + "/lightbox")).text();
  assert.doesNotMatch(html, /<div[^>]*data-lightbox-overlay/);
  assert.match(html, /id="lb-inline">(<!--[^>]*-->)*<section class="lightbox__inline"/);
  assert.match(html, /class="lightbox__container"/);
  assert.match(html, /class="button button--icon-only button--md button--tertiary lightbox__button lightbox__next"/);
  assert.doesNotMatch(html, /<script[^>]*data-boot/);
});

test("lightbox: open at slide 2, HeroUI CSS, keys / thumbnails / captions toggle, Escape restores focus", async () => {
  await onPage(async (page) => {
    await page.click("#lb-open");
    await page.waitForSelector(`${root} [role=dialog]`);
    await page.waitForFunction((r) => document.querySelector(`${r} .lightbox__counter`)?.textContent === "2 / 4", root);
    const css = await page.evaluate(() => {
      const backdrop = getComputedStyle(document.querySelector("[data-lightbox-overlay]")!);
      const button = getComputedStyle(document.querySelector("[data-lightbox-root] .lightbox__next")!);
      const captions = getComputedStyle(document.querySelector("[data-lightbox-root] .lightbox__captions")!);
      return { position: backdrop.position, blur: backdrop.backdropFilter, buttonColor: button.color, captionsBg: captions.backgroundImage };
    });
    assert.equal(css.position, "fixed");
    assert.match(css.blur, /blur/);
    assert.equal(css.buttonColor, "rgb(255, 255, 255)");
    assert.match(css.captionsBg, /linear-gradient/);
    assert.equal(await page.textContent(`${root} .lightbox__captions-title`), "Green");
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction((r) => document.querySelector(`${r} .lightbox__counter`)?.textContent === "3 / 4", root);
    assert.equal(await page.textContent("#lb-index"), "2");
    await page.click(`${root} .lightbox__thumbnail >> nth=0`);
    await page.waitForFunction((r) => document.querySelector(`${r} .lightbox__counter`)?.textContent === "1 / 4", root);
    await page.click(`${root} [data-action=captions]`);
    await page.waitForFunction((r) => !document.querySelector(`${r} .lightbox__captions`), root);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("[data-lightbox-root]"));
    assert.equal(await page.evaluate(() => document.activeElement?.id), "lb-open");
    assert.equal(await counter(page).catch(() => null), null);
  });
});

test("lightbox: inline Next after resume", async () => {
  await onPage(async (page) => {
    const current = () => page.getAttribute("#lb-inline [data-lightbox-slide][data-current] img", "alt");
    assert.equal(await current(), "Red");
    await page.click("#lb-inline .lightbox__next");
    await page.waitForFunction(() => document.querySelector("#lb-inline [data-lightbox-slide][data-current] img")?.getAttribute("alt") === "Green");
  });
});
