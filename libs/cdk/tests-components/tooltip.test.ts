// Ported from react-aria-components test/Tooltip.test.js (Apache-2.0, © Adobe) against the built story
// app (production build, resumed pages, real Chromium): `/tooltip`. RAC renders with fake timers and
// `delay={0}`; here the stories use `delay={0}` too and the default-delay cases wait real time.
// Plus: the warmup / cooldown swap, `trigger="focus"`, `isDisabled`, `shouldCloseOnPress`, Escape and
// the standalone Tooltip (RAC `triggerRef`).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { among, codeOf, stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const open = async (path = "/tooltip") => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + path);
  return { page, seen };
};
/** Tooltip `id` rendered and not exiting. */
const shown = (page: Page, id: string, value = true) =>
  page.waitForFunction(
    ([id, value]) => {
      const el = document.getElementById(id as string);
      return (!!el && !el.hasAttribute("data-exiting")) === value;
    },
    [id, value] as const,
  );
const gone = (page: Page, id: string) => page.waitForFunction((id) => !document.getElementById(id), id);
const describedBy = (page: Page, selector: string) => page.locator(selector).getAttribute("aria-describedby");
// RAC: `fireEvent.mouseMove(document.body)` (pointer modality), then `user.hover(button)`.
const hover = async (page: Page, selector: string) => {
  await page.mouse.move(2, 2);
  await page.hover(selector);
};

test("closed tooltips render nothing at SSR; no tooltip code before interaction", async () => {
  const { page, seen } = await open();
  assert.equal(await page.locator("[role=tooltip]").count(), 0);
  assert.equal(await describedBy(page, "#edit-button"), null);
  // Tooltip code: chunks holding its symbols + the shared code only they import (build manifest; route chunks by default).
  assert.deepEqual(among(seen.scripts, codeOf(/^@rivetjs\/cdk\/tooltip\/|#Tooltip\w*\$/)), [], "no tooltip chunk at load: " + seen.scripts.join(","));
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("shows on hover", async () => {
  const { page, seen } = await open();
  await hover(page, "#edit-button");
  await shown(page, "edit");
  const tooltip = page.locator("#edit");
  assert.equal(await tooltip.getAttribute("role"), "tooltip");
  assert.equal(await describedBy(page, "#edit-button"), "edit");
  assert.equal(await tooltip.getAttribute("class"), "rv-Tooltip");
  await page.waitForFunction(() => document.getElementById("edit")?.getAttribute("data-placement") === "top");
  assert.equal(await tooltip.evaluate((el) => getComputedStyle(el).position), "absolute");
  assert.equal(await tooltip.getAttribute("data-test"), "tooltip");
  const arrow = tooltip.locator(".rv-OverlayArrow");
  assert.equal(await arrow.evaluate((el) => getComputedStyle(el).position), "absolute");
  // Above the trigger, arrow on the bottom edge.
  const [tip, button] = await Promise.all([tooltip.boundingBox(), page.locator("#edit-button").boundingBox()]);
  assert.ok(tip!.y + tip!.height <= button!.y + 1, "placed on top");
  // Leaving closes (closeDelay 500).
  await page.mouse.move(2, 2);
  await gone(page, "edit");
  assert.equal(await describedBy(page, "#edit-button"), null);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("shows on hover when button has isPending", async () => {
  const { page } = await open();
  await hover(page, "#pending-button");
  await shown(page, "pending");
  assert.equal((await page.locator("#pending").textContent())?.trim(), "Tooltip content");
  await page.close();
});

test("shows on focus", async () => {
  const { page, seen } = await open();
  await page.focus("#edit-button");
  await page.waitForLoadState("networkidle");
  // Programmatic focus is not focus-visible; the keyboard is.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await shown(page, "edit");
  assert.equal(await describedBy(page, "#edit-button"), "edit");
  assert.equal(await page.locator("#edit").getAttribute("data-placement"), "top");
  assert.equal(await page.locator("#edit .rv-OverlayArrow").evaluate((el) => getComputedStyle(el).position), "absolute");
  // Focus never moves into the tooltip.
  assert.equal(await page.evaluate(() => document.activeElement?.id), "edit-button");
  // Blur closes immediately.
  await page.keyboard.press("Tab");
  await gone(page, "edit");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("does not show on pointer focus (focus-visible only)", async () => {
  const { page } = await open();
  await page.mouse.move(2, 2);
  await page.locator("#focus-only-button").click();
  await page.waitForTimeout(150);
  assert.equal(await page.locator("#focus-only").count(), 0);
  await page.close();
});

// Resume fuzz shape (`/tooltip` #styled-button, BLUR-FIX 2026-10-18): the resumed page's first input is a mouse click
// on a `delay={0}` trigger — hover, press and focus arrive in one gesture, replayed cold when the trigger's chunk is not
// loaded yet. As on a client-rendered page, the pointer focus shows no ring (the trigger's region re-created during the
// replay refocuses its replacement without switching the modality to keyboard / virtual).
const firstClick = async () => {
  const opened = await open();
  await opened.page.mouse.move(1279, 799);
  await opened.page.locator("#styled-button").click();
  await opened.page.waitForTimeout(400);
  return opened;
};

test("a first mouse click on a resumed trigger keeps focus on it without a focus ring", async () => {
  const { page, seen } = await firstClick();
  assert.equal(await page.evaluate(() => document.activeElement?.id), "styled-button");
  assert.equal(await page.locator("#styled-button").getAttribute("data-focus-visible"), null);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

// Open (pre-dates the route default; 862805e7 fails it too): on a cold first click the replayed `pointerenter` opens
// the `delay={0}` tooltip and installs its close-on-press document listener, but the replayed `pointerdown` only runs
// resumed handlers on the event path — a listener attached during the replay never sees it — so the press does not
// close the tooltip. The fuzz saw it once route chunks left the trigger's chunk unloaded at the first click
// (`/tooltip` #styled-button: `aria-describedby="styled"`). Owner: runtime / cdk (cold press, docs/guides/resumability.md
// "Cold press"). Delete `.fails` when fixed.
test.fails("a first mouse click on a resumed trigger opens no tooltip", async () => {
  const { page } = await firstClick();
  try {
    assert.equal(await page.locator("#styled").count(), 0);
    assert.equal(await describedBy(page, "#styled-button"), null);
  } finally {
    await page.close();
  }
});

test("should support render props", async () => {
  const { page } = await open();
  await hover(page, "#render-button");
  await shown(page, "render");
  await page.waitForFunction(() => document.getElementById("render")?.textContent?.trim() === "Content at bottom");
  await page.close();
});

test("supports overriding styles", async () => {
  const { page } = await open();
  await hover(page, "#styled-button");
  await shown(page, "styled");
  assert.match((await page.locator("#styled").getAttribute("style")) ?? "", /z-index: 5/);
  await page.close();
});

test("supports entering / exiting transitions (data-entering, data-exiting)", async () => {
  const { page } = await open();
  // First warm tooltip of a sequence: default delay (1500 ms), animates in.
  const entering = page.waitForFunction(() => document.getElementById("warm-1")?.hasAttribute("data-entering"), undefined, { timeout: 5000 });
  await hover(page, "#warm-1-button");
  await entering;
  await page.waitForFunction(() => document.getElementById("warm-1")?.hasAttribute("data-entering") === false);
  await page.close();
});

test("should hide tooltip on scroll", async () => {
  const { page } = await open();
  await page.locator("[aria-label=trigger-1]").scrollIntoViewIfNeeded();
  await hover(page, "[aria-label=trigger-1]");
  await shown(page, "scroll-1");
  await page.locator("#scroll-container").evaluate((el) => (el.scrollTop = 100));
  await gone(page, "scroll-1");
  await page.close();
});

test("portalProvider: renders in the PortalProvider's container", async () => {
  const { page } = await open();
  await page.locator("#portal-button").scrollIntoViewIfNeeded();
  await hover(page, "#portal-button");
  await shown(page, "portal");
  assert.equal(await page.locator("#portal").evaluate((el) => el.closest("[data-testid=custom-container]")?.id), "custom-container");
  await page.close();
});

test("should support custom focusable trigger on focus and on hover", async () => {
  const { page } = await open();
  assert.equal(await page.locator("#focusable-span").getAttribute("tabindex"), "0");
  await page.focus("#styled-button");
  // Let the focus handler's chunk load (it installs modality tracking) before the keyboard moves on.
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "focusable-span");
  await shown(page, "focusable");
  await page.keyboard.press("Escape");
  await gone(page, "focusable");
  await page.close();

  const second = await open();
  await hover(second.page, "#focusable-span");
  await shown(second.page, "focusable"); // default delay
  await second.page.close();
});

test("should not override child properties (tabindex, excludeFromTabOrder)", async () => {
  const { page } = await open();
  assert.equal(await page.locator("#excluded-button").getAttribute("tabindex"), "-1");
  assert.equal(await page.locator("#edit-button").getAttribute("tabindex"), null);
  await page.close();
});

test("closes on Escape and on press; shouldCloseOnPress={false} keeps it", async () => {
  const { page, seen } = await open();
  await hover(page, "#edit-button");
  await shown(page, "edit");
  await page.keyboard.press("Escape");
  await gone(page, "edit");
  await page.mouse.move(2, 2);
  await hover(page, "#edit-button");
  await shown(page, "edit");
  await page.mouse.down();
  await gone(page, "edit");
  await page.mouse.up();
  await page.mouse.move(2, 2);
  await hover(page, "#keep-button");
  await shown(page, "keep");
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(100);
  await shown(page, "keep");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("trigger=focus ignores hover; isDisabled never opens", async () => {
  const { page } = await open();
  await hover(page, "#focus-only-button");
  await page.waitForTimeout(150);
  assert.equal(await page.locator("#focus-only").count(), 0);
  await page.focus("#excluded-button");
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "focus-only-button");
  await shown(page, "focus-only");
  await hover(page, "#disabled-button");
  await page.waitForTimeout(150);
  assert.equal(await page.locator("#disabled").count(), 0);
  await page.focus("#focus-only-button");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(150);
  assert.equal(await page.locator("#disabled").count(), 0);
  await page.close();
});

test("warmup: the second tooltip opens instantly and replaces the first; hovering the tooltip keeps it open", async () => {
  const { page, seen } = await open();
  await hover(page, "#warm-1-button");
  await page.waitForTimeout(500);
  assert.equal(await page.locator("#warm-1").count(), 0, "still warming up");
  await shown(page, "warm-1");
  await page.waitForFunction(() => document.getElementById("tooltip-changes")?.textContent === "changes=o");
  // Warm: moving to the next trigger swaps instantly, without exit / entry animations.
  await page.hover("#warm-2-button");
  await shown(page, "warm-2");
  assert.equal(await page.locator("#warm-1").count(), 0, "replaced instantly");
  assert.equal(await page.locator("#warm-2").getAttribute("data-entering"), null);
  await page.waitForFunction(() => document.getElementById("tooltip-changes")?.textContent === "changes=oc");
  // Hovering the tooltip keeps it open (useTooltip).
  const box = (await page.locator("#warm-2").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
  await page.waitForTimeout(300);
  await shown(page, "warm-2");
  await page.mouse.move(2, 2);
  await gone(page, "warm-2");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("standalone Tooltip (triggerRef + isOpen)", async () => {
  const { page } = await open();
  // Room below the anchor (no flip).
  await page.locator("#anchor").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.click("#toggle-standalone");
  await shown(page, "standalone");
  await page.waitForFunction(() => document.getElementById("standalone")?.getAttribute("data-placement") === "bottom");
  assert.equal(await describedBy(page, "#anchor"), "standalone");
  await page.click("#toggle-standalone");
  await gone(page, "standalone");
  await page.close();
});

test("trigger Button's own onFocus / onBlur chain with the TooltipTrigger's (SSR + resume)", async () => {
  const { page, seen } = await open();
  await page.keyboard.press("Tab"); // keyboard modality
  await page.focus("#events-button");
  await shown(page, "events");
  await page.focus("#toggle-standalone");
  await gone(page, "events");
  await page.waitForFunction(() => document.getElementById("focus-log")?.textContent === "log=fb");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("standalone Tooltip with isOpen + onOpenChange opens on a resumed page", async () => {
  const { page, seen } = await open();
  await page.locator("#anchor-2").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.click("#toggle-standalone-2");
  await shown(page, "standalone-2");
  assert.equal(await describedBy(page, "#anchor-2"), "standalone-2");
  await page.click("#toggle-standalone-2");
  await gone(page, "standalone-2");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
