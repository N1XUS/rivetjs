// Color components — resumed story app (`/colors`): SSR markup (BEM blocks, swatch / area / track custom properties), HeroUI CSS
// applied, no page errors; resumed ColorArea key + drag, ColorSlider key + track drag (the gradient + checkerboard background in a real
// engine), ColorField typing + blur commit, ColorSwatchPicker click (selected indicator scales in), ColorPicker open → preset → the
// two-way value and the trigger swatch follow, Escape closes.
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

test("colors: SSR markup + HeroUI CSS", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/colors");
    assert.match((await page.getAttribute("#sw [data-slot=color-swatch]", "class")) ?? "", /color-swatch--lg/);
    assert.match((await page.getAttribute("#sw [data-slot=color-swatch]", "style")) ?? "", /--color-swatch-current:\s*rgba\(4, 133, 247, 1\)/);
    assert.match((await page.getAttribute("#area [data-slot=color-area]", "style")) ?? "", /--color-area-background/);
    const track = (await page.getAttribute("#alpha [data-slot=color-slider-track]", "style")) ?? "";
    assert.match(track, /linear-gradient/);
    assert.match(track, /repeating-conic-gradient/);
    assert.match(track, /--track-start-color/);
    assert.equal(await page.textContent("#hue [data-slot=color-slider-output]"), "120°");
    // Vendored CSS: the swatch is sized, the area is a block with a height.
    assert.ok((await page.$eval("#sw [data-slot=color-swatch]", (el) => el.getBoundingClientRect().width)) > 0);
    assert.ok((await page.$eval("#area [data-slot=color-area]", (el) => el.getBoundingClientRect().height)) > 0);
    await page.waitForLoadState("networkidle");
    assert.deepEqual(seen.errors, []);
  }));

test("colors: ColorArea key + drag after resume", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/colors");
    await page.waitForLoadState("networkidle");
    await page.focus("#area input[type=range]");
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => /hsb\(200, 51%, 50%\)/.test(document.querySelector("#area-value")?.textContent ?? ""));
    const box = (await page.$eval("#area [data-slot=color-area]", (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }))!;
    await page.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.w * 0.9, box.y + box.h * 0.1, { steps: 4 });
    await page.mouse.up();
    await page.waitForFunction(() => {
      const m = /hsb\(200, (\d+)%, (\d+)%\)/.exec(document.querySelector("#area-value")?.textContent ?? "");
      return m != null && Number(m[1]) >= 85 && Number(m[2]) >= 85;
    });
    assert.deepEqual(seen.errors, []);
  }));

test("colors: ColorSlider key + track drag after resume", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/colors");
    await page.waitForLoadState("networkidle");
    await page.focus("#hue input[type=range]");
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.querySelector("#hue-value")?.textContent === "121");
    await page.waitForFunction(() => document.querySelector("#hue [data-slot=color-slider-output]")?.textContent === "121°");
    const box = (await page.$eval("#hue [data-slot=color-slider-track]", (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }))!;
    await page.mouse.move(box.x + box.w * 0.25, box.y + box.h / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.w * 0.75, box.y + box.h / 2, { steps: 4 });
    await page.mouse.up();
    await page.waitForFunction(() => {
      const v = Number(document.querySelector("#hue-value")?.textContent);
      return v > 250 && v < 290;
    });
    // Free drag, animated snap on release (cdk Slider deviation): the thumb settles on the stepped hue.
    await page.waitForFunction(() => {
      const thumb = document.querySelector<HTMLElement>("#hue [data-slot=color-slider-thumb]");
      const v = Number(document.querySelector("#hue-value")?.textContent);
      return thumb != null && !thumb.hasAttribute("data-snapping") && Math.abs(parseFloat(thumb.style.left) - (v / 360) * 100) < 0.01;
    });
  }));

test("colors: ColorField typing commits on blur", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/colors");
    await page.waitForLoadState("networkidle");
    await page.fill("#cf input", "#22c55e");
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => document.querySelector("#cf-value")?.textContent === "#22C55E");
    assert.equal(await page.inputValue("#cf input"), "#22C55E");
  }));

test("colors: ColorSwatchPicker click selects a preset", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/colors");
    await page.waitForLoadState("networkidle");
    await page.click("#csp [role=option] >> nth=1");
    await page.waitForFunction(() => document.querySelector("#csp-value")?.textContent === "#22C55E");
    assert.equal(await page.getAttribute("#csp [role=option] >> nth=1", "aria-selected"), "true");
    // Selected item: the checkmark scales in (vendored CSS transition).
    await page.waitForFunction(() => {
      const icon = document.querySelectorAll("#csp [data-slot=color-swatch-picker-checkmark]")[1];
      return icon != null && getComputedStyle(icon).transform.startsWith("matrix(1, 0, 0, 1");
    });
  }));

test("colors: ColorPicker open → preset → value + trigger swatch, Escape closes", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/colors");
    assert.equal(await page.$("[data-slot=color-picker-popover]"), null);
    await page.waitForLoadState("networkidle");
    await page.click("#cp [data-slot=color-picker-trigger]");
    await page.waitForSelector("[data-slot=color-picker-popover] [role=listbox]");
    assert.notEqual(await page.$eval("[data-slot=color-picker-popover]", (el) => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
    await page.click("[data-slot=color-picker-popover] [role=option] >> nth=0");
    await page.waitForFunction(() => document.querySelector("#cp-value")?.textContent === "rgba(239, 68, 68, 1)");
    // The trigger swatch is kept (live props P5: no re-creation); its style binding's chunk may arrive after the value.
    await page.waitForFunction(() => /rgba\(239, 68, 68, 1\)/.test(document.querySelector("#cp [data-slot=color-swatch]")?.getAttribute("style") ?? ""));
    assert.match((await page.getAttribute("#cp [data-slot=color-swatch]", "style")) ?? "", /rgba\(239, 68, 68, 1\)/);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector("[data-slot=color-picker-popover]") === null);
    assert.deepEqual(seen.errors, []);
  }));
