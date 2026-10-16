// Link, RouterProvider, Breadcrumbs, Group, Toolbar: cases ported from react-aria-components
// test/{Link,Breadcrumbs,Group,Toolbar}.test.* and react-aria test/{link/useLink,breadcrumbs/*}.test.js
// (Apache-2.0, © Adobe), against the resumed story app (production build).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, libraryScripts, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const attr = (page: Page, selector: string, name: string) => page.getAttribute(selector, name);
const focusedId = (page: Page, id: string) => page.waitForFunction((id) => document.activeElement?.id === id, id);
const text = (page: Page, selector: string, value: string) =>
  page.waitForFunction(([selector, value]) => document.querySelector(selector!)?.textContent?.trim() === value, [selector, value]);

test("link: <a> with href, <span role=link> without, disabled, aria-current, no JS before interaction", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/links");
  assert.equal(await page.evaluate(() => document.querySelector("#plain")!.localName), "a");
  assert.equal(await attr(page, "#plain", "class"), "rv-Link");
  assert.equal(await attr(page, "#plain", "role"), null);
  assert.equal(await attr(page, "#pressable", "role"), "link");
  assert.equal(await attr(page, "#pressable", "tabindex"), "0");
  assert.equal(await page.evaluate(() => document.querySelector("#off")!.localName), "span");
  assert.equal(await attr(page, "#off", "aria-disabled"), "true");
  assert.equal(await attr(page, "#off", "data-disabled"), "true");
  assert.equal(await attr(page, "#off", "tabindex"), null);
  assert.equal(await attr(page, "#current", "aria-current"), "page");
  assert.equal(await attr(page, "#current", "data-current"), "true");
  assert.deepEqual(libraryScripts(seen), []);
  // A plain link navigates natively.
  await page.click("#plain");
  await page.waitForFunction(() => location.hash === "#plain-target");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("link: press state and events (mouse, keyboard Enter), disabled link ignores presses", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/links");
  const box = (await page.locator("#pressable").boundingBox())!;
  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.down();
  await page.waitForFunction(() => document.querySelector("#pressable")?.getAttribute("data-pressed") === "true");
  await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector("#pressable")?.hasAttribute("data-pressed"));
  await text(page, "#link-log", "pressstart:mouse pressend:mouse press:mouse click");
  await page.focus("#pressable");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#link-log")!.textContent!.includes("press:keyboard"));
  const before = await page.textContent("#link-log");
  await page.click("#off", { force: true });
  assert.equal(await page.textContent("#link-log"), before, "disabled: no press events");
  await page.close();
});

test("link: RouterProvider maps hrefs (useHref) and routes clicks through navigate with routerOptions", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/links");
  assert.equal(await attr(page, "#routed", "href"), "/base/foo");
  assert.equal(await attr(page, "#routed-off", "href"), "/base/foo");
  await page.click("#routed");
  await text(page, "#nav-log", '/foo {"foo":"bar"}');
  assert.equal(new URL(page.url()).pathname, "/links", "no document navigation");
  // Disabled: no navigation.
  await page.evaluate(() => (document.querySelector("#nav-log")!.textContent = ""));
  await page.click("#routed-off", { force: true }); // aria-disabled: Playwright treats it as not enabled
  await page.waitForTimeout(100);
  assert.equal(await page.textContent("#nav-log"), "");
  await page.close();
});

test("breadcrumbs: <ol> labelled, last item current + disabled, onAction, isDisabled, items preset + Link render props", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/links");
  assert.equal(await attr(page, "#crumbs", "aria-label"), "Breadcrumbs");
  assert.equal(await attr(page, "#crumbs", "class"), "rv-Breadcrumbs");
  assert.equal(await attr(page, "#crumbs-action", "aria-label"), "Trail");
  const items = await page.$$eval("#crumbs > li", (lis) =>
    lis.map((li) => ({ cls: li.className, current: li.getAttribute("data-current"), link: li.firstElementChild!.localName, ariaCurrent: li.firstElementChild!.getAttribute("aria-current") })),
  );
  assert.deepEqual(items, [
    { cls: "rv-Breadcrumb", current: null, link: "a", ariaCurrent: null },
    { cls: "rv-Breadcrumb", current: null, link: "a", ariaCurrent: null },
    { cls: "rv-Breadcrumb", current: "true", link: "span", ariaCurrent: "page" },
  ]);
  assert.equal(await attr(page, "#crumbs > li:last-child > span", "aria-disabled"), "true");
  assert.deepEqual(libraryScripts(seen), []);
  // onAction with the item key.
  await page.click("#crumbs-action > li:nth-child(2) > a");
  await text(page, "#crumb-action", "docs");
  // isDisabled: every crumb disabled.
  assert.deepEqual(await page.$$eval("#crumbs-off > li > *", (els) => els.map((el) => el.getAttribute("aria-disabled"))), ["true", "true", "true"]);
  // items preset: each Breadcrumb's Link receives the context (current page on the last one; isCurrent render prop).
  assert.equal(await attr(page, "#crumbs-slot > li:last-child > span", "aria-current"), "page");
  assert.equal(await attr(page, "#crumbs-slot > li:last-child > span", "class"), "crumb current");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("group: role, class, disabled / invalid / readonly, focus-within + focus-visible, hover callbacks", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/links");
  assert.equal(await attr(page, "#group", "role"), "group");
  assert.equal(await attr(page, "#group", "class"), "rv-Group");
  assert.equal(await attr(page, "#group-off", "role"), "region");
  for (const name of ["data-disabled", "data-invalid", "data-readonly"]) assert.equal(await attr(page, "#group-off", name), "true");
  assert.equal(await attr(page, "#group", "data-focus-visible"), null);
  // Keyboard focus inside: focus-within + focus-visible.
  await page.focus("#current");
  await page.keyboard.press("Tab"); // routed links come next in DOM order? focus the input directly instead
  await page.focus("#group-button");
  await page.keyboard.press("Shift+Tab");
  await focusedId(page, "group-input");
  await page.waitForFunction(() => document.querySelector("#group")?.getAttribute("data-focus-within") === "true");
  await page.waitForFunction(() => document.querySelector("#group")?.getAttribute("data-focus-visible") === "true");
  await page.click("#before");
  await page.waitForFunction(() => !document.querySelector("#group")?.hasAttribute("data-focus-within"));
  // Pointer focus + typing: no focus ring.
  await page.click("#group-input");
  await page.keyboard.type("a");
  await page.waitForFunction(() => document.querySelector("#group")?.getAttribute("data-focus-within") === "true");
  assert.equal(await attr(page, "#group", "data-focus-visible"), null);
  // Hover.
  await page.hover("#group-button");
  await page.waitForFunction(() => document.querySelector("#group")?.getAttribute("data-hovered") === "true");
  await text(page, "#crumb-action", "hover:true");
  await page.mouse.move(0, 0);
  await text(page, "#crumb-action", "hover:false");
  await page.close();
});

test("toolbar: arrows move across groups and separators (no wrap), Tab leaves, re-entry restores the last control", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/links");
  assert.equal(await attr(page, "#tools", "role"), "toolbar");
  assert.equal(await attr(page, "#tools", "aria-orientation"), "horizontal");
  assert.equal(await attr(page, "#tools", "aria-label"), "Tools");
  await page.focus("#before");
  await page.keyboard.press("Tab");
  await focusedId(page, "align-left");
  await page.keyboard.press("ArrowRight");
  await focusedId(page, "align-center");
  await page.keyboard.press("ArrowDown"); // horizontal: ignored
  await focusedId(page, "align-center");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight"); // across the <hr> into the next group
  await focusedId(page, "zoom-in");
  await page.keyboard.press("ArrowLeft");
  await focusedId(page, "align-right");
  // Tab leaves the toolbar; Shift+Tab re-enters at the last focused control.
  await page.keyboard.press("Tab");
  await focusedId(page, "after");
  await page.keyboard.press("Shift+Tab");
  await focusedId(page, "align-right");
  await page.keyboard.press("Shift+Tab");
  await focusedId(page, "before");
  await page.keyboard.press("Tab");
  await focusedId(page, "align-right");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await focusedId(page, "align-left");
  await page.keyboard.press("ArrowLeft"); // no wrap
  await focusedId(page, "align-left");
  await page.click("#zoom-out");
  await page.keyboard.press("ArrowRight");
  await focusedId(page, "zoom-out");
  await page.keyboard.press("Enter"); // other keys do not move focus
  await focusedId(page, "zoom-out");
  await page.close();
});

test("toolbar: vertical orientation uses Up / Down; RTL flips Left / Right", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/links");
  assert.equal(await attr(page, "#vtools", "aria-orientation"), "vertical");
  await page.focus("#v1");
  await page.keyboard.press("ArrowRight");
  await focusedId(page, "v1");
  await page.keyboard.press("ArrowDown");
  await focusedId(page, "v2");
  await page.keyboard.press("ArrowUp");
  await focusedId(page, "v1");
  await page.focus("#r1");
  await page.keyboard.press("ArrowLeft");
  await focusedId(page, "r2");
  await page.keyboard.press("ArrowRight");
  await focusedId(page, "r1");
  await page.close();
});
