// Global DOM events / attributes (RAC GlobalDOMAttributes) on collection components and their parts:
// ListBox (+ options, sections), Tabs (+ tablist, tabs, panels), MenuTrigger (+ menu, items),
// Virtualizer, CdkVirtualScrollViewport, CdkVirtualScrollableElement. Run against the resumed story build.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const logged = (page: Page, entry: string) =>
  page
    .waitForFunction((entry) => document.querySelector("#d-log")!.textContent!.split(" ").includes(entry), entry, { timeout: 5000 })
    .catch(async () => assert.fail(`"${entry}" not in log: ${await page.textContent("#d-log")}`));
const textIs = (page: Page, selector: string, value: string) =>
  page
    .waitForFunction(([selector, value]) => document.querySelector(selector!)?.textContent === value, [selector, value] as const, { timeout: 5000 })
    .catch(async () => assert.equal(await page.textContent(selector), value));
const attr = (page: Page, selector: string, name: string) => page.getAttribute(selector, name);

test("collections: global DOM attributes render on roots and parts, absent elsewhere", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/dom-events-collections");
  assert.equal(await attr(page, "#d-list", "lang"), "en");
  assert.equal(await attr(page, "#d-list", "dir"), "ltr");
  assert.equal(await attr(page, "#d-list [data-key=apple]", "lang"), "fr");
  assert.equal(await attr(page, "#d-list [data-key=pear]", "lang"), null);
  assert.equal(await attr(page, "#d-list section[role=group]", "lang"), "de");
  assert.equal(await attr(page, "#d-tabs", "lang"), "en");
  assert.equal(await attr(page, "#d-tabs [role=tablist]", "dir"), "ltr");
  assert.equal(await attr(page, "#d-tabs [role=tab][data-key=two]", "lang"), "it");
  assert.equal(await attr(page, "#d-tabs [role=tab][data-key=one]", "lang"), null);
  assert.deepEqual(
    await page.$$eval("#d-tabs .rv-TabPanel", (els) => els.map((el) => [el.getAttribute("lang"), el.getAttribute("role"), (el as HTMLElement).inert])),
    [
      [null, "tabpanel", false],
      ["es", null, true],
    ],
    "TabPanel DOM props forwarded; a force-mounted inactive panel is inert, without the tabpanel role (RAC)",
  );
  assert.equal(await attr(page, "#d-menu-trigger", "lang"), "en");
  assert.equal(await attr(page, "#d-virt", "lang"), "en");
  assert.equal(await attr(page, "#d-vp", "lang"), "en");
  assert.equal(await attr(page, "#d-scrollable", "lang"), "en");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("listbox: root and option / section events forward (resumed); owned click still selects", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/dom-events-collections");
  await page.hover("#d-list [data-key=pear]");
  await logged(page, "list-enter");
  await logged(page, "pear-enter");
  await page.click("#d-list [data-key=apple]");
  await textIs(page, "#d-picked", "apple");
  await logged(page, "list-click");
  await page.dblclick("#d-list [data-key=apple]");
  await logged(page, "apple-dbl");
  await page.click("#d-list [data-key=plum]", { button: "right" });
  await logged(page, "plum-menu");
  await logged(page, "list-menu");
  await page.hover("#d-list [data-key=plum]");
  await page.mouse.wheel(0, 10);
  await logged(page, "sec-wheel");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("tabs: root, tablist, tab and panel events forward; owned tablist click still selects", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/dom-events-collections");
  await page.hover("#d-tabs [role=tab][data-key=one]");
  await logged(page, "tabs-enter");
  await page.click("#d-tabs [role=tab][data-key=two]");
  await textIs(page, "#d-tab", "two");
  // RA usePress stops a tab click's propagation (RAC: the TabList onClick sees no tab clicks); dblclick bubbles.
  await page.dblclick("#d-tabs [role=tab][data-key=two]");
  await logged(page, "tablist-dbl");
  await page.click("#d-tabs [role=tab][data-key=one]", { button: "right" });
  await logged(page, "tab-one-menu");
  await page.dblclick("#d-tabs [role=tabpanel][lang=es]");
  await logged(page, "panel-two-dbl");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("menu: trigger, menu and item events forward; owned clicks still open the menu and act", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/dom-events-collections");
  await page.hover("#d-menu-trigger");
  await logged(page, "trigger-enter");
  await page.click("#d-menu-trigger");
  await page.waitForSelector("#d-menu[role=menu]");
  await logged(page, "trigger-click");
  assert.equal(await attr(page, "#d-menu", "lang"), "pt");
  assert.equal(await attr(page, "#d-menu [data-key=paste]", "lang"), "nl");
  await page.hover("#d-menu [data-key=copy]");
  await logged(page, "menu-enter");
  await page.click("#d-menu [data-key=copy]", { button: "right" });
  await logged(page, "copy-menu");
  await page.click("#d-menu [data-key=paste]");
  await textIs(page, "#d-action", "paste");
  await logged(page, "menu-click");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("virtualizer / virtual scroll viewport / scrollable element: events forward; owned scroll still drives the engine", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/dom-events-collections");
  await page.hover("#d-virt");
  await logged(page, "virt-enter");
  await page.mouse.wheel(0, 320);
  await logged(page, "virt-wheel");
  await logged(page, "virt-scroll");
  await page.waitForFunction(() => document.querySelector("#d-virt")!.textContent!.includes("Row 12"));
  await page.hover("#d-vp");
  await logged(page, "vp-enter");
  await page.dblclick("#d-vp");
  await logged(page, "vp-dbl");
  await page.$eval("#d-vp", (el) => (el.scrollTop = 5000));
  await logged(page, "vp-scroll");
  await page.waitForFunction(() => document.querySelector("#d-vp .row")?.textContent?.trim() === "Item 98");
  await page.hover("#d-scrollable");
  await logged(page, "scrollable-enter");
  await page.$eval("#d-scrollable", (el) => (el.scrollTop = 100));
  await logged(page, "scrollable-scroll");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("collections with signal props and JSX content (spread elements read props up front): render and resume", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  const response = await page.goto(s.origin + "/dom-events-collections");
  assert.equal(response?.status(), 200);
  assert.equal(await page.textContent("#j-list [data-key=a] b"), "A");
  assert.equal(await page.textContent("#j-tabs [role=tab][data-key=one] b"), "One");
  assert.equal(await page.textContent("#j-menu-trigger b"), "JSX actions");
  assert.equal(await attr(page, "#j-menu-trigger", "lang"), "en");
  assert.equal(await attr(page, "#j-virt", "lang"), "en");
  assert.equal(await attr(page, "#j-vp", "lang"), "en");
  assert.equal(await page.textContent("#j-scrollable b"), "JSX scrollable");
  await page.click("#j-list [data-key=b]");
  await textIs(page, "#j-picked", "b");
  await page.click("#j-tabs [role=tab][data-key=two]");
  await textIs(page, "#j-tab", "two");
  await page.click("#j-menu-trigger");
  await page.waitForSelector("#j-menu[role=menu]");
  await page.click("#j-menu [data-key=paste]");
  await textIs(page, "#j-action", "paste");
  await page.hover("#j-virt");
  await page.mouse.wheel(0, 320);
  await page.waitForFunction(() => document.querySelector("#j-virt")!.textContent!.includes("Row 12"));
  await page.$eval("#j-vp", (el) => (el.scrollTop = 5000));
  await page.waitForFunction(() => document.querySelector("#j-vp .jrow")?.textContent?.trim() === "Item 98");
  await page.hover("#j-scrollable");
  await logged(page, "j-scrollable-enter");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
