// Tabs: behavioural cases ported from react-aria-components test/Tabs.test.js + Tabs.browser.test.tsx
// (Apache-2.0, © Adobe), against the resumed story app (production build).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, focused, libraryScripts, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const focusedId = (page: Page, id: string) => page.waitForFunction((id) => document.activeElement?.id === id, id);
const text = (page: Page, selector: string, value: string) =>
  page.waitForFunction(([selector, value]) => document.querySelector(selector!)?.textContent?.replace(/\s+/g, " ").trim() === value, [selector, value]);
const attr = (page: Page, selector: string, name: string) => page.getAttribute(selector, name);
const selectedOf = (page: Page, list: string) =>
  page.evaluate(
    (list) => [...document.querySelectorAll(`#${list} > [role=tablist] > [role=tab][aria-selected=true]`)].map((t) => t.getAttribute("data-key")),
    list,
  );

test("tabs: renders roles, ids, orientation, panels (hidden + inert), no library JS before interaction", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/tabs");
  assert.equal(await attr(page, "#product [role=tablist]", "aria-orientation"), "horizontal");
  assert.equal(await attr(page, "#product [role=tablist]", "aria-label"), "Product");
  assert.equal(await attr(page, "#product-tab-specs", "aria-selected"), "true");
  assert.equal(await attr(page, "#product-tab-specs", "aria-controls"), "product-tabpanel-specs");
  assert.equal(await attr(page, "#product-tab-specs", "tabindex"), "0");
  assert.equal(await attr(page, "#product-tab-overview", "tabindex"), "-1");
  assert.equal(await attr(page, "#product-tab-reviews", "aria-disabled"), "true");
  assert.equal(await attr(page, "#product-tab-reviews", "tabindex"), null, "disabled tabs are not focusable");
  assert.equal(await attr(page, "#product-tabpanel-specs", "aria-labelledby"), "product-tab-specs");
  assert.equal(await attr(page, "#product-tab-overview", "aria-controls"), null, "aria-controls only on the selected tab (useTab)");
  assert.equal(await attr(page, "#product-tab-specs", "data-selected"), "true");
  assert.equal(await attr(page, "#product-tab-reviews", "data-disabled"), "true");
  // `items` preset: every panel force-mounted, inactive ones hidden + inert without the tabpanel role / id (RAC).
  assert.deepEqual(
    await page.$$eval("#product .rv-TabPanel", (els) => els.map((el) => [el.id, el.getAttribute("role"), el.hasAttribute("hidden"), el.hasAttribute("inert")])),
    [
      ["", null, true, true],
      ["product-tabpanel-specs", "tabpanel", false, false],
      ["", null, true, true],
      ["", null, true, true],
    ],
  );
  assert.equal(await attr(page, "#product [role=tablist]", "id"), "product-tablist");
  // Parts: the server build pass selects the first enabled tab; only its panel is rendered.
  assert.deepEqual(await selectedOf(page, "parts"), ["pb"]);
  assert.equal(await attr(page, "#parts [role=tablist]", "aria-label"), "Parts horizontal");
  assert.equal(await attr(page, "#parts-tab-pb", "class"), "rv-Tab on");
  assert.equal(await page.textContent("#parts-tab-pb .pb-label"), "B (selected)");
  assert.deepEqual(await page.$$eval("#parts .rv-TabPanel", (els) => els.map((el) => el.id)), ["parts-tabpanel-pb"]);
  assert.equal(await attr(page, "#manual [role=tablist]", "aria-orientation"), "vertical");
  assert.equal(await attr(page, "#manual", "data-orientation"), "vertical");
  assert.deepEqual(await selectedOf(page, "keys"), ["specs"], "first non-disabled tab is selected by default");
  assert.deepEqual(libraryScripts(seen), []);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("tabs: automatic activation — arrows skip disabled and wrap, Home / End, two-way selectedKey", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/tabs");
  await page.focus("#product-tab-specs");
  await page.keyboard.press("ArrowRight");
  await focusedId(page, "product-tab-faq"); // reviews disabled: skipped
  await text(page, "#tab-value", "Tab: faq");
  assert.equal(await attr(page, "#product-tab-faq", "aria-selected"), "true");
  assert.equal(await attr(page, "#product-tab-faq", "tabindex"), "0");
  assert.equal(await attr(page, "#product-tab-specs", "tabindex"), "-1");
  assert.equal(await page.isVisible("#product-tabpanel-faq"), true);
  assert.equal(await page.isVisible("#product-tabpanel-specs"), false);
  await page.keyboard.press("ArrowRight");
  await focusedId(page, "product-tab-overview"); // wraps
  await page.keyboard.press("ArrowLeft");
  await focusedId(page, "product-tab-faq"); // wraps back
  await page.keyboard.press("Home");
  await focusedId(page, "product-tab-overview");
  await page.keyboard.press("End");
  await focusedId(page, "product-tab-faq");
  await page.keyboard.press("ArrowDown"); // not handled by a horizontal tablist
  assert.equal((await focused(page)).id, "product-tab-faq");
  await page.keyboard.press("s"); // TabsKeyboardDelegate has no getKeyForSearch: no typeahead
  assert.equal((await focused(page)).id, "product-tab-faq");
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await text(page, "#tab-value", "Tab: specs");
  // Selection set from outside while the tablist is not focused moves the tab stop.
  await page.click("#pick-faq");
  await text(page, "#tab-value", "Tab: faq");
  assert.equal(await attr(page, "#product-tab-faq", "tabindex"), "0");
  assert.equal(await attr(page, "#product-tab-specs", "tabindex"), "-1");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("tabs: keyboardActivation=manual + vertical — arrows move focus, Enter / Space select; Left/Right follow direction too", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/tabs");
  await page.focus("#manual-tab-overview");
  await page.keyboard.press("ArrowDown");
  await focusedId(page, "manual-tab-specs");
  assert.equal(await attr(page, "#manual-tab-specs", "aria-selected"), "false");
  assert.equal(await attr(page, "#manual-tab-overview", "aria-selected"), "true");
  assert.equal(await attr(page, "#manual-tab-specs", "tabindex"), "0");
  await page.keyboard.press("ArrowRight"); // TabsKeyboardDelegate: left/right work in both orientations
  await focusedId(page, "manual-tab-faq");
  await page.keyboard.press("ArrowUp");
  await focusedId(page, "manual-tab-specs");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#manual-tab-specs")?.getAttribute("aria-selected") === "true");
  assert.equal(await page.isVisible("#manual-tabpanel-specs"), true);
  await page.keyboard.press("ArrowDown");
  await focusedId(page, "manual-tab-faq");
  await page.keyboard.press(" ");
  await page.waitForFunction(() => document.querySelector("#manual-tab-faq")?.getAttribute("aria-selected") === "true");
  // Manual: tabbing out after moving focus without selecting keeps the moved tab stop (useTabListState).
  await page.keyboard.press("ArrowUp");
  await focusedId(page, "manual-tab-specs");
  assert.equal(await attr(page, "#manual-tab-faq", "aria-selected"), "true");
  await page.focus("#pick-faq");
  assert.equal(await attr(page, "#manual-tab-specs", "tabindex"), "0");
  await page.close();
});

test("tabs: RTL — ArrowLeft moves forward, ArrowRight back", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/tabs");
  await page.focus("#rtl-tab-overview");
  await page.keyboard.press("ArrowLeft");
  await focusedId(page, "rtl-tab-specs");
  await page.keyboard.press("ArrowRight");
  await focusedId(page, "rtl-tab-overview");
  await page.close();
});

test("tabs: pointer — mouse down selects, isDisabled list and disabled tabs ignore presses, virtual click selects", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/tabs");
  const box = (await page.locator("#product-tab-overview").boundingBox())!;
  await page.mouse.move(box.x + 5, box.y + 5);
  await page.mouse.down();
  await text(page, "#tab-value", "Tab: overview"); // selection on press start
  await page.mouse.up();
  await focusedId(page, "product-tab-overview");
  await page.click("#product-tab-reviews", { force: true });
  await text(page, "#tab-value", "Tab: overview");
  // Whole list disabled.
  for (const key of ["overview", "specs"]) {
    assert.equal(await attr(page, `#off-tab-${key}`, "aria-disabled"), "true");
    assert.equal(await attr(page, `#off-tab-${key}`, "tabindex"), null);
  }
  await page.click("#off-tab-specs", { force: true });
  assert.deepEqual(await selectedOf(page, "off"), ["overview"]);
  // Virtual click (assistive technology / element.click()).
  await page.evaluate(() => (document.querySelector("#product-tab-faq") as HTMLElement).click());
  await text(page, "#tab-value", "Tab: faq");
  await page.close();
});

test("tabs: number keys round-trip, onSelectionChange fires per change; TabPanel with tabbable content is no tab stop", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/tabs");
  assert.equal(await attr(page, "#num-tab-2", "data-key-type"), "number");
  await page.click("#num-tab-3");
  await text(page, "#num-value", "Num: 3 (number), changes: 1");
  await page.keyboard.press("ArrowLeft");
  await text(page, "#num-value", "Num: 2 (number), changes: 2");
  // Tab from the tablist goes straight to the first tabbable element of the panel.
  await page.keyboard.press("Tab");
  await page.waitForFunction(() => document.activeElement?.textContent === "Inside Two");
  assert.equal(await attr(page, "#num-tabpanel-2", "tabindex"), null);
  await page.close();
});

test("tabs: link tabs navigate on click (not mouse down) and Enter; selection stays URL-driven", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/tabs");
  assert.equal(await page.evaluate(() => document.querySelector("#links-tab-b")!.localName), "a");
  assert.equal(await attr(page, "#links-tab-b", "href"), "#section-b");
  await page.locator("#links-tab-b").scrollIntoViewIfNeeded();
  const box = (await page.locator("#links-tab-b").boundingBox())!;
  await page.mouse.move(box.x + 5, box.y + 5);
  await page.mouse.down();
  assert.equal(await page.evaluate(() => location.hash), "", "no navigation on mouse down");
  await page.mouse.up();
  await page.waitForFunction(() => location.hash === "#section-b");
  assert.deepEqual(await selectedOf(page, "links"), ["a"], "linkBehavior selection: the URL drives selection");
  await page.focus("#links-tab-a");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => location.hash === "#section-a");
  await page.close();
});

test("tabs: parts — selecting creates the panel from its render-function child on the resumed page, render props follow", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/tabs");
  await page.click("#parts-tab-pc");
  await page.waitForFunction(() => document.querySelector("#parts-tabpanel-pc")?.textContent === "Panel C");
  assert.deepEqual(await page.$$eval("#parts .rv-TabPanel", (els) => els.map((el) => el.id)), ["parts-tabpanel-pc"]);
  assert.equal(await attr(page, "#parts-tab-pb", "class"), "rv-Tab off");
  assert.equal(await page.textContent("#parts-tab-pb .pb-label"), "B");
  await text(page, "#parts-changes", "Changes: pc");
  await page.keyboard.press("ArrowLeft"); // automatic activation
  await focusedId(page, "parts-tab-pb");
  await page.waitForFunction(() => document.querySelector("#parts-tabpanel-pb")?.textContent?.includes("Panel B"));
  assert.equal(await attr(page, "#parts-tab-pb", "class"), "rv-Tab on");
  assert.equal(await attr(page, "#parts-tab-pb", "data-focus-visible"), "true");
  assert.equal(await attr(page, "#parts", "data-focused"), "true");
  await text(page, "#parts-changes", "Changes: pcpb");
  // The panel created in the browser holds a button: no tab stop of its own (useHasTabbableChild).
  await page.waitForFunction(() => !document.querySelector("#parts-tabpanel-pb")?.hasAttribute("tabindex"));
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("tabs: parts with items — selecting another row's tab creates its panel on the resumed page", async () => {
  // TabPanels renders its item rows tracked: on the server the rows' panel `Show` reads are the TabPanels site's resume
  // dependencies (an untracked body left no region: the newly selected panel never rendered — cdk-docs tabs-nested).
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/tabs");
  const first = await page.$$eval("#item-parts [role=tab]", (els) => els.map((el) => el.id));
  assert.ok(first.length > 1);
  await page.click("#" + first[1]);
  const panel = first[1]!.replace("-tab-", "-tabpanel-");
  await page.waitForFunction((id) => !!document.getElementById(id)?.textContent?.includes("item panel"), panel);
  assert.deepEqual(await page.$$eval("#item-parts .rv-TabPanel", (els) => els.map((el) => el.id)), [panel]);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("tabs: nested tabs keep their own keyboard navigation", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/tabs");
  await page.focus("#inner-first-tab-1");
  await page.keyboard.press("ArrowRight");
  await focusedId(page, "inner-first-tab-2");
  assert.deepEqual(await selectedOf(page, "outer"), ["first"]);
  assert.equal(await attr(page, "#outer-tab-first", "aria-selected"), "true");
  await page.focus("#outer-tab-first");
  await page.keyboard.press("ArrowRight");
  await focusedId(page, "outer-tab-second");
  assert.equal(await page.isVisible("#inner-second-tab-1"), true);
  await page.close();
});
