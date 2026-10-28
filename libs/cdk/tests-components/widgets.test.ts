// Keyboard behaviour per APG pattern against the built story app (production build, resume).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, focused, hinted, libraryScripts, type Stories } from "./harness.ts";

let s: Stories;
// Fetch-ahead on (`data-fo`): the "preloaded when visible" / cold-key checks expect the page's chunks fetched after load.
beforeAll(async () => (s = await stories({ preload: {} })));
afterAll(async () => s?.close());

const focusedId = (page: Page, id: string) => page.waitForFunction((id) => document.activeElement?.id === id, id);
const text = (page: Page, selector: string, value: string) =>
  page.waitForFunction(([selector, value]) => document.querySelector(selector!)?.textContent?.replace(/\s+/g, " ").trim() === value, [selector, value]);
// Overlays render in the div overlay layer only while open (or animating out).
const mounted = (page: Page, selector: string, open = true) =>
  page.waitForFunction(([selector, open]) => (document.querySelector(selector as string) != null) === open, [selector, open] as const);

test("menu: opens from the keyboard, roves, skips disabled, activates, Escape restores focus", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/menu");
  // RA useOverlayTrigger({ type: "menu" }): aria-haspopup="true".
  assert.equal(await page.getAttribute("#edit-trigger", "aria-haspopup"), "true");
  assert.equal(await page.getAttribute("#edit-trigger", "aria-expanded"), "false");
  assert.equal(await page.locator("#edit").count(), 0, "closed: not rendered");
  await page.focus("#edit-trigger");
  const before = await page.evaluate(() => scrollY);
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-key") === "copy");
  assert.equal(await page.evaluate(() => scrollY), before, "cold ArrowDown did not scroll");
  assert.equal(await page.getAttribute("#edit-trigger", "aria-expanded"), "true");
  await page.keyboard.press("ArrowDown"); // cold: the menu's handler loads, the held key replays
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-key") === "paste");
  await page.keyboard.press("ArrowDown"); // delete disabled: skipped
  assert.equal((await focused(page)).key, "rename");
  await page.keyboard.press("End");
  assert.equal((await focused(page)).key, "docs");
  await page.keyboard.press("Home");
  assert.equal((await focused(page)).key, "copy");
  await page.keyboard.press("r"); // typeahead
  assert.equal((await focused(page)).key, "rename");
  await page.keyboard.press("Enter");
  await text(page, "#menu-value", "Last action: rename (1)");
  await focusedId(page, "edit-trigger");
  await mounted(page, "#edit", false);

  // ArrowUp opens on the last item; Escape closes and returns focus.
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-key") === "docs");
  await page.keyboard.press("Escape");
  await focusedId(page, "edit-trigger");
  await mounted(page, "#edit", false);

  // Click opens with the menu itself focused (RA: mouse press → focusStrategy null); ArrowDown, Space activates.
  await page.click("#edit-trigger");
  await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "menu");
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-key") === "copy");
  await page.keyboard.press("Space");
  await text(page, "#menu-value", "Last action: copy (2)");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("dialog: trigger opens modal, autofocus, Escape closes and restores focus, alertdialog", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/dialog");
  const trigger = page.getByRole("button", { name: "Open settings" });
  assert.equal(await trigger.getAttribute("aria-haspopup"), null, "react-aria: no aria-haspopup for dialogs");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await mounted(page, "#settings");
  await focusedId(page, "settings-name");
  assert.equal(await page.getByRole("dialog", { name: "Settings" }).count(), 1, "labelled by its title");
  // Focus stays inside the modal (FocusScope contain).
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => !!document.activeElement?.closest("#settings")), true);
  await page.keyboard.press("Escape");
  await mounted(page, "#settings", false);
  assert.equal(await trigger.evaluate((el) => el === document.activeElement), true, "focus restored to the trigger");

  // Alert dialog: role alertdialog, close button closes.
  await page.getByRole("button", { name: "Delete…" }).click();
  await mounted(page, "#confirm");
  assert.equal(await page.getByRole("alertdialog", { name: "Delete the file?" }).count(), 1);
  await page.getByRole("button", { name: "Cancel" }).click();
  await mounted(page, "#confirm", false);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("popover: toggle, Escape and light dismiss", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/popover");
  await page.focus("#info-trigger");
  await page.keyboard.press("Enter");
  await mounted(page, "#info");
  assert.equal(await page.getByRole("dialog", { name: "Shipping" }).count(), 1);
  await page.keyboard.press("Escape");
  await mounted(page, "#info", false);
  await focusedId(page, "info-trigger");
  await page.click("#info-trigger");
  await mounted(page, "#info");
  await page.mouse.click(5, 400);
  await mounted(page, "#info", false); // light dismiss
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("buttons: toggle aria-pressed, onPress callback", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/buttons");
  await page.focus("#bold");
  await page.keyboard.press("Space");
  await text(page, "#bold-value", "Bold: on");
  assert.equal(await page.getAttribute("#bold", "aria-pressed"), "true");
  await page.keyboard.press("Enter");
  await text(page, "#bold-value", "Bold: off");
  await page.click("#press");
  await page.click("#press");
  await text(page, "#press-value", "Presses: 2");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("form fields: native controls, labels, descriptions, two-way state, exclusive disclosures", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/forms");
  // Accessible names / descriptions from SSR markup.
  assert.equal(await page.getByRole("checkbox", { name: "Accept terms" }).count(), 1);
  assert.equal(await page.getByRole("switch", { name: "Wi-Fi" }).count(), 1);
  assert.equal(await page.getByRole("radiogroup", { name: "Size" }).count(), 1);
  const name = page.getByRole("textbox", { name: "Name" });
  assert.equal(await name.getAttribute("required"), "");
  // The server markup lists the description id only: the FieldError id is gated on validity (RAC FieldError renders
  // only while invalid, so its slot id never reaches the input while the field is valid).
  const described = () =>
    name.evaluate((el) =>
      (el.getAttribute("aria-describedby") ?? "")
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "<missing>")
        .join(" | "),
    );
  assert.equal(await described(), "As on your passport", "server markup: description id only");
  assert.equal(await page.getAttribute("#email", "aria-invalid"), "true");
  assert.equal(await page.textContent("#email-error"), "Enter an email address");
  // Disclosures work with no JavaScript (native details name group).
  assert.equal(await page.evaluate(() => document.querySelector<HTMLDetailsElement>("#faq-1")!.open), true);
  await page.click("#faq-2 summary");
  // A cold summary click inside a listening record is held until its chunk ran, then its default replays (CEFF
  // 2026-10-28: before, the page's idle boot had adopted everything before the click).
  await page.waitForFunction(() => document.querySelector<HTMLDetailsElement>("#faq-2")!.open);
  assert.equal(await page.evaluate(() => document.querySelector<HTMLDetailsElement>("#faq-1")!.open), false, "exclusive group");
  // Fetch-ahead (this file opts in) hints the page's chunks after load: only code fetched beyond those counts.
  const hints = new Set(await hinted(page));
  assert.deepEqual(
    libraryScripts(seen).filter((script) => !hints.has(script)),
    [],
    "details need no library code",
  );

  // A cold Space keeps the server-rendered control (and the keyboard focus): no re-render.
  await page.evaluate(() => ((document.querySelector("#terms") as HTMLElement & { __server?: boolean }).__server = true));
  await page.focus("#terms");
  await page.keyboard.press("Space");
  await text(page, "#forms-value", "terms=yes wifi=on size=m name=");
  assert.equal((await focused(page)).id, "terms", "focus stays on the checkbox");
  assert.equal(await page.evaluate(() => (document.querySelector("#terms") as HTMLElement & { __server?: boolean }).__server), true, "same element");
  await page.keyboard.press("Tab");
  assert.equal((await focused(page)).id, "wifi");
  await page.keyboard.press("Space");
  await text(page, "#forms-value", "terms=yes wifi=off size=m name=");
  assert.equal((await focused(page)).id, "wifi");
  // Writes to the signal reach the control: uncheck through the label (pointer) and back.
  await page.click("label:has(#terms)");
  await text(page, "#forms-value", "terms=no wifi=off size=m name=");
  await page.click("label:has(#terms)");
  await page.getByRole("radio", { name: "Large" }).check();
  await name.fill("Ada");
  await text(page, "#forms-value", "terms=yes wifi=off size=l name=Ada");
  // Still only the description id after typing (the field stays valid).
  await page.waitForFunction(() => document.getElementById("name")?.getAttribute("aria-describedby") === "name-description", null, { timeout: 10000 });
  assert.equal(await described(), "As on your passport");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("FocusScope: Tab wraps at both ends, also for the first (cold) Tab on a resumed page", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/focus-scope");
  // Cold: the browser moves focus before the scope's handler loads; the handler must judge by the
  // element the key was pressed on, so a Tab from the middle item is left alone.
  await page.focus("#scope-save");
  await page.keyboard.press("Tab");
  await focusedId(page, "scope-cancel");
  await page.waitForLoadState("networkidle");
  assert.equal((await focused(page)).id, "scope-cancel", "the late handler did not wrap");
  await page.keyboard.press("Tab");
  await focusedId(page, "scope-title");
  await page.keyboard.press("Shift+Tab");
  await focusedId(page, "scope-cancel");
  await page.keyboard.press("Shift+Tab");
  await focusedId(page, "scope-save");
  assert.deepEqual(seen.errors, []);
  await page.close();

  // Cold Tab from the last item wraps to the first once the handler ran.
  const cold = await s.browser.newPage();
  await cold.goto(s.origin + "/focus-scope");
  await cold.focus("#scope-cancel");
  await cold.keyboard.press("Tab");
  await focusedId(cold, "scope-title");
  await cold.close();
});

test("callbacks: fragment-rooted const arrow and inline arrow props resume (source package captures)", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/callbacks");
  await page.click("#cb-press");
  await text(page, "#cb-value", "none / 1");
  await page.click("#cb-menu-trigger"); // RA: a mouse press focuses the menu itself
  await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "menu");
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-key") === "copy");
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-key") === "paste");
  await page.keyboard.press("Enter");
  await text(page, "#cb-value", "paste / 1");
  await page.click("#cb-inline-trigger"); // RA: a mouse press focuses the menu itself
  await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "menu");
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-key") === "cut");
  await page.keyboard.press("Enter");
  await text(page, "#cb-value", "inline cut / 1");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
