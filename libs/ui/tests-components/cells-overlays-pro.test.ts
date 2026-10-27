// CellSwitch / HoverCard / EmojiReactionButton on a resumed page (`/cells-overlays-pro`; Rivet additions, feature sets
// inspired by HeroUI Pro's public docs): no component script before input; a press anywhere in the cell row toggles the
// bound signal, disabled rows ignore presses; the hover card opens on hover and keyboard focus (role=dialog, trigger
// aria-expanded), Tab moves into it, Escape closes; the reaction toggles aria-pressed, the read-only one keeps its state.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { nonRuntimeScripts, stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("cells + overlays pro: nothing before input, then switch / hover card / reaction behave", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 900 } });
  const seen = watch(page);
  await page.goto(s.origin + "/cells-overlays-pro");
  await page.waitForLoadState("networkidle");
  assert.deepEqual(
    nonRuntimeScripts(seen).filter((u) => /cell-switch|hover-card|emoji-reaction|preview-trigger|toggle-button/i.test(u)),
    [],
  );

  // CellSwitch: a press on the row start (the label text) toggles: the whole row is the switch's label
  await page.click("#cs [data-slot=switch-content]", { position: { x: 20, y: 10 } });
  await page.waitForFunction(() => document.querySelector("#cs-state")?.textContent === "on");
  assert.equal(await page.evaluate(() => (document.querySelector("#cs input") as HTMLInputElement).checked), true);
  await page.click("#cs-disabled [data-slot=switch-content]", { force: true });
  assert.equal(await page.evaluate(() => (document.querySelector("#cs-disabled input") as HTMLInputElement).checked), false);

  // HoverCard: hover opens, leave closes
  await page.hover("#hc");
  await page.waitForSelector("#hc-card[role=dialog]");
  assert.equal(await page.getAttribute("#hc", "aria-expanded"), "true");
  assert.equal(await page.evaluate(() => document.querySelector("#hc-card [data-slot=hover-card-arrow]") !== null), true);
  await page.mouse.move(5, 5);
  await page.waitForSelector("#hc-card", { state: "detached" });
  // keyboard: focus opens, Tab moves into the card, Escape closes
  await page.focus("#erb");
  await page.keyboard.press("Shift+Tab"); // #after
  await page.keyboard.press("Shift+Tab"); // #hc
  await page.waitForSelector("#hc-card[role=dialog]");
  await page.keyboard.press("Tab");
  await page.waitForFunction(() => document.activeElement?.id === "hc-link");
  await page.keyboard.press("Escape");
  await page.waitForSelector("#hc-card", { state: "detached" });

  // EmojiReactionButton
  assert.equal(await page.getAttribute("#erb", "aria-pressed"), "false");
  await page.click("#erb");
  await page.waitForFunction(() => document.querySelector("#erb")?.getAttribute("aria-pressed") === "true");
  await page.click("#erb-ro");
  await page.waitForTimeout(100);
  assert.equal(await page.getAttribute("#erb-ro", "aria-pressed"), "true");
  assert.equal(await page.getAttribute("#erb-ro", "data-readonly"), "true");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
