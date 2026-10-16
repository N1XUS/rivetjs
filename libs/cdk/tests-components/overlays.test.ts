// Overlays (ported from react-aria-components Dialog / Modal / Popover / Tooltip / Toast / Disclosure /
// DropZone / FileTrigger tests, Apache-2.0, © Adobe) against the built story app (production build, resume).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, focused, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const focusedId = (page: Page, id: string) => page.waitForFunction((id) => document.activeElement?.id === id, id);
const text = (page: Page, selector: string, value: string) =>
  page.waitForFunction(([selector, value]) => document.querySelector(selector!)?.textContent?.replace(/\s+/g, " ").trim() === value, [selector, value]);
// Overlays render in the div overlay layer only while open (or animating out): open = mounted and not exiting.
const shown = (id: string) => {
  const el = document.getElementById(id);
  return !!el && !el.hasAttribute("data-exiting");
};
const isModal = (page: Page, id: string) => page.evaluate(shown, id);
const waitModal = (page: Page, id: string, open = true) =>
  page.waitForFunction(([id, open]) => (document.getElementById(id as string) != null) === open, [id, open] as const);

test("modal: alertdialog labelled + described, render-prop close, aria-expanded, onOpenChange, focus restore", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/modal");
  const trigger = page.locator("#alert-trigger");
  assert.equal(await trigger.getAttribute("aria-expanded"), "false");
  assert.equal(await trigger.getAttribute("aria-haspopup"), null, "react-aria: no aria-haspopup for dialogs");
  assert.equal(await page.locator("#alert").count(), 0, "closed: not rendered");
  await trigger.click();
  await waitModal(page, "alert");
  const dialog = page.getByRole("alertdialog", { name: "Alert" });
  assert.equal(await dialog.count(), 1, "labelled by the heading");
  assert.equal(await dialog.evaluate((el) => document.getElementById(el.getAttribute("aria-describedby")!)?.textContent), "This is the alert message.");
  await focusedId(page, "alert"); // the dialog itself takes focus
  await page.waitForFunction(() => document.querySelector("#alert-trigger")?.getAttribute("aria-expanded") === "true");
  assert.equal(await trigger.getAttribute("aria-controls"), "alert");
  await page.click("#alert-close");
  await waitModal(page, "alert", false);
  await focusedId(page, "alert-trigger");
  await text(page, "#modal-value", "changes=oc controlled=closed");
  assert.equal(await trigger.getAttribute("aria-expanded"), "false");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("modal: isDismissable (outside click, Dismiss button), autofocus content, Escape, nested dialogs", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/modal");
  await page.click("#dismissable-trigger");
  await waitModal(page, "dismissable");
  await focusedId(page, "dismissable-name");
  // Focus is contained (FocusScope contain; the page outside is inert).
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => !!document.activeElement?.closest("#dismissable"));
  }
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), "hidden", "scroll lock");
  await page.mouse.click(5, 300);
  await waitModal(page, "dismissable", false);
  // Dismiss button (visually hidden, for screen readers).
  await page.click("#dismissable-trigger");
  await waitModal(page, "dismissable");
  // RAC DOM: the DismissButton is the Modal element's first child, before the Dialog.
  await page.locator(".rv-Modal:has(> #dismissable) > div > button[aria-label=Dismiss]").evaluate((el: HTMLElement) => el.click());
  await waitModal(page, "dismissable", false);
  // Nested: Escape closes the inner one only.
  await page.click("#dismissable-trigger");
  await waitModal(page, "dismissable");
  await page.click("#nested-trigger");
  await waitModal(page, "nested");
  await page.keyboard.press("Escape");
  await waitModal(page, "nested", false);
  assert.equal(await isModal(page, "dismissable"), true);
  await focusedId(page, "nested-trigger");
  await page.keyboard.press("Escape");
  await waitModal(page, "dismissable", false);
  await focusedId(page, "dismissable-trigger");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("modal: a standalone Modal opened from a MenuItem action closes on Escape and an outside press (D3-3)", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/modal");
  for (const close of ["Escape", "outside"]) {
    await page.focus("#menu-modal-trigger");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-key") === "open");
    await page.keyboard.press("Enter");
    await waitModal(page, "menu-modal");
    await page.waitForSelector("#menu-modal-menu", { state: "detached" });
    await focusedId(page, "menu-modal");
    await text(page, "#menu-modal-state", "open");
    if (close === "Escape") await page.keyboard.press("Escape");
    else await page.mouse.click(5, 300);
    await waitModal(page, "menu-modal", false);
    await text(page, "#menu-modal-state", "closed");
  }
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("modal: isKeyboardDismissDisabled, shouldCloseOnInteractOutside, standalone controlled Modal", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/modal");
  await page.click("#locked-trigger");
  await waitModal(page, "locked");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(50);
  assert.equal(await isModal(page, "locked"), true, "Escape does not close");
  await page.mouse.click(5, 300);
  await waitModal(page, "locked", false); // still dismissable by an outside click

  await page.click("#filtered-trigger");
  await waitModal(page, "filtered");
  await page.mouse.click(5, 20); // on the underlay: filtered out
  await page.waitForTimeout(50);
  assert.equal(await isModal(page, "filtered"), true, "filtered outside interaction");
  await page.keyboard.press("Escape");
  await waitModal(page, "filtered", false);

  await page.click("#open-controlled");
  await waitModal(page, "controlled");
  await text(page, "#modal-value", "changes= controlled=open");
  assert.equal(await page.getByRole("dialog", { name: "Controlled" }).count(), 1);
  await page.mouse.click(5, 300);
  await waitModal(page, "controlled", false);
  await text(page, "#modal-value", "changes= controlled=closed");
  assert.equal((await focused(page)).id, "open-controlled");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("modal: the first open after resume enters (data-entering until onEnter settles), then exits", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/modal");
  await page.click("#animated-trigger");
  await waitModal(page, "animated");
  assert.equal(await page.getAttribute("#animated-overlay", "data-entering"), "true", "entering on the first open of a server-closed branch");
  await page.waitForFunction(() => !document.getElementById("animated-overlay")!.hasAttribute("data-entering"));
  await page.keyboard.press("Escape");
  await waitModal(page, "animated", false);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

const popoverOpen = waitModal;
const rect = (page: Page, selector: string) => page.locator(selector).evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);

test("popover: dialog labelled by trigger / title, focus moves in and is contained, inert outside, scroll lock, restore", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/popover");
  const trigger = page.locator("#help-trigger");
  assert.equal(await trigger.getAttribute("aria-expanded"), "false");
  await trigger.click();
  await popoverOpen(page, "help");
  assert.equal(await page.getByRole("dialog", { name: "Help" }).count(), 1, "named by the trigger without a title");
  await focusedId(page, "help");
  await page.waitForFunction(() => document.querySelector("#help-trigger")?.getAttribute("aria-expanded") === "true");
  assert.equal(await trigger.getAttribute("aria-controls"), "help");
  await page.waitForFunction(() => !!document.querySelector("#outside")!.closest("[inert]"));
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), "hidden");
  await page.keyboard.press("Tab");
  await focusedId(page, "help-close");
  await page.keyboard.press("Tab");
  await focusedId(page, "help-close"); // contained (single tabbable)
  // Render prop close.
  await page.click("#help-close");
  await popoverOpen(page, "help", false);
  await focusedId(page, "help-trigger");
  assert.equal(await page.evaluate(() => !!document.querySelector("#outside")!.closest("[inert]")), false);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), "visible");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

/** The popover around the `help` Dialog (RAC composition: Popover > OverlayArrow + Dialog). */
const HELP = ".rv-Popover:has(#help)";

test("popover: placement, offset, crossOffset, arrow, flip, trigger width", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 700 } });
  const seen = watch(page);
  await page.goto(s.origin + "/popover");
  await page.click("#help-trigger");
  await popoverOpen(page, "help");
  await page.waitForFunction(
    () =>
      document.querySelector(".rv-Popover:has(#help)")?.getAttribute("data-placement") === "top" &&
      (document.querySelector(".rv-Popover:has(#help)") as HTMLElement).style.position !== "",
  );
  const t = await rect(page, "#help-trigger"),
    p = await rect(page, HELP);
  assert.ok(Math.abs(p.bottom + 12 - t.top) < 1.5, `offset 12 above the trigger (${p.bottom} vs ${t.top})`);
  assert.ok(Math.abs(p.left + p.width / 2 - (t.left + t.width / 2) - 4) < 1.5, "centred + crossOffset 4");
  const arrow = await rect(page, HELP + " > .rv-OverlayArrow");
  assert.ok(Math.abs(arrow.left + arrow.width / 2 - (t.left + t.width / 2)) < 1.5, "arrow points at the trigger centre");
  assert.equal(await page.getAttribute(HELP + " > .rv-OverlayArrow", "data-placement"), "top");
  assert.ok((await page.locator(HELP).evaluate((el) => el.style.getPropertyValue("--trigger-width"))).endsWith("px"));
  await page.keyboard.press("Escape");
  await popoverOpen(page, "help", false);
  // Flip: no room above once the trigger is at the top of the viewport.
  await page.evaluate(() => window.scrollTo(0, document.querySelector<HTMLElement>("#help-trigger")!.getBoundingClientRect().top + scrollY - 4));
  await page.click("#help-trigger");
  await popoverOpen(page, "help");
  await page.waitForFunction(() => document.querySelector(".rv-Popover:has(#help)")?.getAttribute("data-placement") === "bottom");
  assert.ok((await rect(page, HELP)).top >= (await rect(page, "#help-trigger")).bottom, "flipped below");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("popover: isNonModal (no inert, closes on blur / Escape), isKeyboardDismissDisabled, light dismiss, standalone isOpen", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/popover");
  await page.click("#nonmodal-trigger");
  await popoverOpen(page, "nonmodal");
  assert.equal(await page.getAttribute("#nonmodal", "popover"), null, "div overlay, not the top layer");
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => !!document.querySelector("#outside")!.closest("[inert]")), false, "non-modal: page stays interactive");
  await page.keyboard.press("Escape");
  await popoverOpen(page, "nonmodal", false);
  await page.click("#nonmodal-trigger");
  await popoverOpen(page, "nonmodal");
  await focusedId(page, "nonmodal");
  await page.focus("#outside"); // blur
  await popoverOpen(page, "nonmodal", false);

  await page.click("#locked-trigger");
  await popoverOpen(page, "locked");
  await focusedId(page, "locked");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(shown, "locked"), true, "Escape disabled");
  await page.mouse.click(5, 650);
  await popoverOpen(page, "locked", false);

  // Default popover: light dismiss on an outside press. Every open renders the whole content (wave 2 bug:
  // the second open showed only the heading).
  for (let round = 0; round < 2; round++) {
    await page.click("#info-trigger");
    await popoverOpen(page, "info");
    await text(page, "#info-description", "Ships in 2 days.");
    await page.mouse.click(5, 650);
    await popoverOpen(page, "info", false);
  }

  await page.click("#open-standalone");
  await popoverOpen(page, "standalone");
  await text(page, "#popover-value", "standalone=open");
  const a = await rect(page, "#anchor"),
    p = await rect(page, "#standalone");
  assert.ok(Math.abs(p.top - (a.bottom + 8)) < 1.5, "anchored below its triggerRef element");
  await page.keyboard.press("Escape");
  await popoverOpen(page, "standalone", false);
  await text(page, "#popover-value", "standalone=closed");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
