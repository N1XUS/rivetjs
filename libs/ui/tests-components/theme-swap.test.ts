// Theme swap (ui-docs `theme-swap` example on the `/visual/theme-swap` route): one attribute (`data-ui-preset`) swaps the
// whole look; the cards' markup never changes and every preset's variables reach the components (radius, borders,
// shadows, backdrop), light and dark.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => {
  s = await stories();
});
afterAll(async () => s?.close());

const PRESETS = ["rivet", "classic", "brutalist", "glass", "mauve"] as const;

for (const scheme of ["light", "dark"] as const)
  test(`theme swap (${scheme}): markup identical across presets, the variables restyle the cards`, async () => {
    const page = await s.browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript((mode) => {
      addEventListener("DOMContentLoaded", () => {
        document.documentElement.dataset.theme = mode;
        document.documentElement.classList.toggle("dark", mode === "dark");
      });
    }, scheme);
    await page.goto(`${s.origin}/visual/theme-swap`, { waitUntil: "networkidle" });
    // The first press defers descendant adoption to idle callbacks. A network-idle event (or a fixed delay) does not
    // acknowledge it: the Slider can still normalize its server styles after the baseline. Exercise its real binding,
    // restore the original value, then leave the cards unfocused before comparing swaps.
    await page.click("[data-testid=ts-preset-rivet]");
    await page.locator("#ts-cards input[type=range]").focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.querySelector("#ts-cards .slider")?.previousElementSibling?.textContent === "1:24");
    await page.keyboard.press("ArrowLeft");
    await page.waitForFunction(() => document.querySelector("#ts-cards .slider")?.previousElementSibling?.textContent === "1:23");
    await page.click("[data-testid=ts-preset-rivet]");
    await page.waitForFunction(() => !document.querySelector("#ts-cards .slider__thumb")?.hasAttribute("data-focused"));
    const cards = () => page.$eval("#ts-cards", (e) => e.outerHTML);
    const baseline = await cards();
    const look: Record<string, { radius: string; backdrop: string; fieldBorder: string; shadow: string; background: string }> = {};
    for (const id of PRESETS) {
      await page.click(`[data-testid=ts-preset-${id}]`);
      await page.waitForFunction((i) => document.querySelector("#theme-swap")?.getAttribute("data-ui-preset") === i, id);
      assert.equal(await cards(), baseline, `${id}: #ts-cards markup changed`);
      look[id] = await page.evaluate(() => {
        const card = getComputedStyle(document.querySelector("#ts-cards .card")!);
        const field = getComputedStyle(document.querySelector("#ts-cards .input-group")!);
        return {
          radius: card.borderTopLeftRadius,
          backdrop: card.backdropFilter,
          fieldBorder: field.borderTopWidth,
          shadow: card.boxShadow,
          background: getComputedStyle(document.querySelector("#theme-swap")!).backgroundColor,
        };
      });
    }
    assert.equal(look.brutalist!.radius, "0px");
    assert.equal(look.brutalist!.fieldBorder, "2px");
    assert.match(look.brutalist!.shadow, /4px 4px 0px 0px/);
    assert.match(look.glass!.backdrop, /blur\(20px\)/);
    assert.equal(look.rivet!.backdrop, "none");
    assert.equal(look.rivet!.fieldBorder, "0px");
    assert.notEqual(look.mauve!.radius, look.rivet!.radius);
    assert.equal(new Set(PRESETS.map((id) => look[id]!.background)).size >= 3, true, JSON.stringify(look));
    assert.deepEqual(errors, []);
    await page.close();
  });
