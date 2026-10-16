// Global DOM events and attributes (react-aria-components GlobalDOMAttributes) on the overlay
// components (Dialog, Modal, Popover, Tooltip, Select, ComboBox) and their parts, against the resumed
// story app: forwarded to each part's element, owned events chained after the component's own.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const logged = (page: Page, ...entries: string[]) =>
  page.waitForFunction((entries) => {
    const log = document.querySelector("#de-log")!.textContent!.split(" ");
    return entries.every((entry) => log.includes(entry));
  }, entries);
const attrs = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const el = document.querySelector(selector)!;
    return { lang: el.getAttribute("lang"), dir: el.getAttribute("dir") };
  }, selector);
const fire = (page: Page, selector: string, type: string) => page.dispatchEvent(selector, type);

test("closed overlays render nothing; root attributes are server-rendered", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/dom-events-overlays");
  assert.equal(await page.locator("#de-dt").count(), 0);
  assert.equal(await page.locator("#de-pop").count(), 0);
  assert.equal(await page.locator("#de-tip").count(), 0);
  assert.equal(await page.locator("#de-sel-popover").count(), 0);
  assert.deepEqual(await attrs(page, "#de-dt-trigger"), { lang: "fr", dir: null });
  assert.deepEqual(await attrs(page, "#de-dialog"), { lang: "de", dir: null });
  assert.deepEqual(await attrs(page, "#de-pop-trigger"), { lang: null, dir: "rtl" });
  assert.deepEqual(await attrs(page, "#de-sel"), { lang: "en", dir: null });
  assert.deepEqual(await attrs(page, "#de-sel-trigger"), { lang: null, dir: "ltr" });
  assert.deepEqual(await attrs(page, "#de-sel-value"), { lang: "en-GB", dir: null });
  assert.deepEqual(await attrs(page, ".rv-ComboBox"), { lang: "en", dir: null });
  assert.equal(await page.locator("#de-combo-list").count(), 0); // RAC: the ListBox renders only while open
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("dialog + modal: trigger, modal element and underlay events; owned click / pointerdown chained", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/dom-events-overlays");
  // Inline Dialog element.
  await fire(page, "#de-dialog", "dblclick");
  await fire(page, "#de-dialog", "contextmenu");
  await logged(page, "d-dbl", "d-menu");
  // DialogTrigger + Button: the trigger's press opens (component), its click logs (user).
  await fire(page, "#de-dt-trigger", "contextmenu");
  await page.click("#de-dt-trigger");
  await page.waitForSelector("#de-dt");
  await logged(page, "t-menu", "t-click");
  assert.deepEqual(await attrs(page, "#de-dt"), { lang: "en", dir: "ltr" });
  assert.equal(await page.evaluate(() => document.getElementById("de-dt")!.parentElement!.getAttribute("dir")), "rtl");
  await page.hover("#de-dt");
  await fire(page, "#de-dt", "dblclick");
  await logged(page, "m-enter", "m-dbl");
  await page.evaluate(() => document.getElementById("de-dt")!.parentElement!.dispatchEvent(new WheelEvent("wheel", { bubbles: true })));
  await logged(page, "u-wheel");
  // Underlay pointerdown: the underlay's own handler runs first (prevents focus loss), then the user's.
  // (Dismissable modals stop it in the capture phase, as upstream useInteractOutside.)
  await page.mouse.click(2, 2);
  await logged(page, "u-down:true");
  assert.equal(await page.locator("#de-dt").count(), 1);
  await page.keyboard.press("Escape");
  await page.waitForSelector("#de-dt", { state: "detached" });
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("popover: trigger, popover element and arrow events; owned click chained", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/dom-events-overlays");
  await fire(page, "#de-pop-trigger", "dblclick");
  await page.click("#de-pop-trigger");
  await page.waitForSelector("#de-pop");
  await logged(page, "pt-dbl", "pt-click");
  assert.equal(await page.getAttribute("#de-pop", "lang"), "es");
  assert.equal(await page.getAttribute("#de-pop .rv-OverlayArrow", "lang"), "pt");
  await fire(page, "#de-pop", "dblclick");
  await page.evaluate(() => document.getElementById("de-pop")!.dispatchEvent(new WheelEvent("wheel", { bubbles: true })));
  await fire(page, "#de-pop .rv-OverlayArrow", "contextmenu");
  await logged(page, "p-dbl", "p-wheel", "pa-menu");
  await page.keyboard.press("Escape");
  await page.waitForSelector("#de-pop", { state: "detached" });
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("tooltip: tooltip element and arrow events; owned pointerenter keeps it open and logs", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/dom-events-overlays");
  await page.hover("#de-tip-button");
  await page.waitForSelector("#de-tip");
  assert.equal(await page.getAttribute("#de-tip", "lang"), "nl");
  assert.equal(await page.getAttribute("#de-tip .rv-OverlayArrow", "lang"), "sv");
  await page.hover("#de-tip");
  await logged(page, "tip-enter");
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#de-tip").count(), 1);
  await fire(page, "#de-tip", "dblclick");
  await fire(page, "#de-tip .rv-OverlayArrow", "contextmenu");
  await logged(page, "tip-dbl", "tipa-menu");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("select: root, trigger, value, popover and listbox events; owned pointerdown / click chained", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/dom-events-overlays");
  await fire(page, "#de-sel", "dblclick");
  await fire(page, "#de-sel-value", "contextmenu");
  // The log line these write pushes the Select down (`#de-log` starts empty): hover only after it is there, else the
  // pointer lands on the tooltip trigger right above (timing-dependent: the handlers resume lazily).
  await logged(page, "s-dbl", "sv-menu");
  await page.hover("#de-sel-trigger");
  // A mouse press opens on pointerdown; the release lands outside the trigger, so no click (as upstream).
  await page.click("#de-sel-trigger");
  await page.waitForSelector("#de-sel-listbox");
  await logged(page, "s-dbl", "sv-menu", "st-enter", "st-down");
  // Park the pointer away from every trigger before Escape: a cold pointerenter on the tooltip trigger
  // would open the tooltip, whose capturing keydown listener consumes the Escape.
  await page.mouse.move(0, 0);
  assert.equal(await page.locator("#de-tip").count(), 0);
  await page.keyboard.press("Escape");
  await page.waitForSelector("#de-sel-listbox", { state: "detached" });
  // Enter on the trigger is prevented by useSelect (no native click, as upstream); a virtual click
  // (screen reader / dispatched, detail 0) opens on the first item and the user's onClick runs.
  await fire(page, "#de-sel-trigger", "click");
  await page.waitForSelector("#de-sel-listbox");
  await logged(page, "st-click");
  assert.equal(await page.getAttribute("#de-sel-popover", "lang"), "fi");
  assert.equal(await page.getAttribute("#de-sel-listbox", "dir"), "ltr");
  await page.evaluate(() => document.getElementById("de-sel-popover")!.dispatchEvent(new WheelEvent("wheel", { bubbles: true })));
  await fire(page, "#de-sel-listbox", "dblclick");
  await logged(page, "sp-wheel", "sl-dbl");
  // Listbox pointerdown: the user's handler runs and the option still selects.
  await page.locator("#de-sel-listbox [role=option]", { hasText: "Dog" }).click();
  await logged(page, "sl-down");
  await page.waitForFunction(() => document.getElementById("de-sel-value")?.textContent === "Dog");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("combobox: root and listbox events; input events, keydown, focus change chained with filtering", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/dom-events-overlays");
  await fire(page, ".rv-ComboBox", "dblclick");
  await page.focus("#de-combo-input");
  await page.keyboard.type("d");
  await page.waitForFunction(() => !!document.getElementById("de-combo-list"));
  assert.equal(await page.getAttribute("#de-combo-list", "lang"), "fr");
  await logged(page, "c-dbl", "c-focus:true", "c-key:d", "c-input");
  await fire(page, "#de-combo-input", "paste");
  await fire(page, "#de-combo-list", "contextmenu");
  await logged(page, "c-paste", "cl-menu");
  // Listbox click: commits (component) and logs (user).
  await page.locator("#de-combo-list [role=option]", { hasText: "Dog" }).click();
  await page.waitForFunction(() => (document.getElementById("de-combo-input") as HTMLInputElement).value === "Dog");
  await logged(page, "cl-click");
  await page.keyboard.press("ArrowDown");
  await logged(page, "c-key:ArrowDown");
  await page.waitForFunction(() => !!document.getElementById("de-combo-list"));
  await page.focus("#de-dt-trigger");
  await logged(page, "c-focus:false");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("modal open on load with a signal isOpen and JSX title / children (in an OverlayProvider): renders and resumes", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  const response = await page.goto(s.origin + "/modal-open");
  assert.equal(response?.status(), 200);
  assert.equal(await page.textContent("#mo-body b"), "JSX body");
  assert.equal(await page.getAttribute(".mo-overlay", "lang"), "en");
  assert.equal(await page.getAttribute("#mo-provider", "class"), "mo-provider");
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.getElementById("mo-open")!.textContent === "false");
  // The resumed close runs the modal's behaviour: no exit animation → the overlay unmounts (RAC).
  await page.waitForFunction(() => document.querySelector(".mo-overlay") == null);
  assert.deepEqual(seen.errors, []);
  await page.close();
});
