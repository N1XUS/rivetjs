// Ported from react-aria-components test/PreviewTrigger.test.js (Apache-2.0, © Adobe) against the built
// story app (production build, resumed pages, real Chromium): `/preview-trigger`. RAC uses fake timers;
// here `delay` 600 waits real time, the fast story uses `delay={0}`.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { among, chunksOf, closureOf, codeOf, stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const open = async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/preview-trigger");
  return { page, seen };
};
const shown = (page: Page, id: string, value = true) =>
  page.waitForFunction(([id, value]) => (document.getElementById(id as string) != null) === value, [id, value] as const);
const hover = async (page: Page, selector: string) => {
  await page.mouse.move(2, 2);
  await page.hover(selector);
};

test("closed previews render nothing at SSR; no preview code before interaction", async () => {
  const { page, seen } = await open();
  assert.equal(await page.locator("#docs-preview").count(), 0);
  // The trigger's own hover chunk may prefetch while visible (planner latency ruling 2026-10-08); the preview / popover
  // code may not. Chunks from the build manifest: with `chunks: "component"` the trigger (`resume-PreviewTrigger-…`)
  // and the popover are separate files; with the default route chunks the popover code the story route alone uses
  // shares the trigger's route chunk (prefetched with it, not run), so only popover code outside the trigger's chunk and
  // its imports is checked.
  const trigger = closureOf(chunksOf(/#PreviewTrigger\$/));
  const popover = [...codeOf(/#Popover\w*\$/)].filter((chunk) => !trigger.has(chunk));
  const early = among(seen.scripts, new Set(popover));
  assert.deepEqual(early, [], "no preview chunk at load: " + seen.scripts.join(","));
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("opens on hover after the delay as a non-modal dialog; trigger ARIA while open; data-trigger", async () => {
  const { page, seen } = await open();
  await hover(page, "#docs-link");
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#docs-preview").count(), 0, "still warming up (600 ms)");
  await shown(page, "docs-preview");
  const preview = page.locator("#docs-preview");
  assert.equal(await preview.getAttribute("role"), "dialog");
  assert.equal(await preview.getAttribute("data-trigger"), "PreviewTrigger");
  assert.equal(await page.getAttribute("#docs-link", "aria-expanded"), "true");
  assert.equal(await page.getAttribute("#docs-link", "aria-haspopup"), "dialog");
  assert.equal(await page.getAttribute("#docs-link", "aria-controls"), "docs-preview");
  assert.match((await page.getAttribute("#docs-link", "aria-describedby")) ?? "", /docs-preview/);
  // Non-modal: the page stays interactive, focus stays on the page.
  assert.equal(await page.evaluate(() => (document.querySelector("#after") as HTMLElement).inert), false);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), "visible");
  // Leaving to an unrelated place closes (closeDelay 200).
  await page.mouse.move(2, 600, { steps: 4 });
  await shown(page, "docs-preview", false);
  assert.equal(await page.getAttribute("#docs-link", "aria-expanded"), "false");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("safe area: moving the pointer from the link into the popover keeps it open (closeDelay 0)", async () => {
  const { page, seen } = await open();
  await hover(page, "#fast-link");
  await shown(page, "fast-preview");
  const link = (await page.locator("#fast-link").boundingBox())!;
  const pop = (await page.locator("#fast-preview").boundingBox())!;
  assert.ok(pop.y > link.y + link.height + 20, "40px gap between link and popover");
  // Travel diagonally through the gap into the popover.
  await page.mouse.move(pop.x + pop.width / 2, pop.y + pop.height / 2, { steps: 12 });
  await page.waitForTimeout(150);
  assert.equal(await page.locator("#fast-preview").count(), 1, "kept open across the gap");
  await page.mouse.move(pop.x + pop.width + 200, pop.y + pop.height + 200, { steps: 4 });
  await shown(page, "fast-preview", false);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("keyboard: opens on focus-visible after the delay; Tab moves into the popover; Escape closes and keeps focus", async () => {
  const { page, seen } = await open();
  // Tab from the top of the page (the layout's links come first) to the link.
  for (let i = 0; i < 60 && (await page.evaluate(() => document.activeElement?.id)) !== "docs-link"; i++) await page.keyboard.press("Tab");
  await page.waitForFunction(() => document.activeElement?.id === "docs-link");
  await shown(page, "docs-preview");
  await page.keyboard.press("Tab");
  await page.waitForFunction(() => document.activeElement?.id === "preview-inside");
  assert.equal(await page.locator("#docs-preview").count(), 1, "focus within keeps it open");
  await page.keyboard.press("Escape");
  await shown(page, "docs-preview", false);
  await page.waitForTimeout(700);
  assert.equal(await page.locator("#docs-preview").count(), 0, "restored focus does not reopen");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("isDisabled never opens", async () => {
  const { page } = await open();
  await hover(page, "#disabled-link");
  await page.waitForTimeout(200);
  assert.equal(await page.locator("#disabled-preview").count(), 0);
  // Keyboard focus does not open it either (Rivet: RA usePreviewTrigger gates only hover / long press).
  await page.mouse.move(2, 2);
  await page.focus("#after");
  await page.keyboard.press("Tab");
  await page.waitForFunction(() => document.activeElement?.id === "disabled-link");
  await page.waitForTimeout(700);
  assert.equal(await page.locator("#disabled-preview").count(), 0, "keyboard focus");
  assert.equal(await page.getAttribute("#disabled-link", "aria-expanded"), "false");
  await page.close();
});
