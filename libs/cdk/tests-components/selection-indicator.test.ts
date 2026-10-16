// SelectionIndicator / SharedElementTransition on a resumed page (story `/selection-indicator`): the
// indicator is server-rendered in the selected tab only, no library JS runs before interaction, and the
// first selection change moves it into the new tab animating from the server-rendered position.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

/** Keys of the tabs / radios holding an indicator. */
const holders = (page: Page, selector: string) =>
  page.evaluate(
    (selector) =>
      [...document.querySelectorAll(selector)]
        .filter((el) => el.querySelector(".rv-SelectionIndicator"))
        .map((el) => el.getAttribute("data-key") ?? el.textContent!.trim()),
    selector,
  );

/** Script responses carrying the SharedElement code (its error message survives minification). */
const sharedElementChunks = (page: Page) => {
  const urls: string[] = [];
  page.on("response", async (response) => {
    if (!/\.m?js$/.test(new URL(response.url()).pathname)) return;
    const body = await response.text().catch(() => "");
    if (body.includes("must be rendered inside a <SharedElementTransition>")) urls.push(new URL(response.url()).pathname);
  });
  return urls;
};

/** Watch the indicator inserted into `holder`: its inline translate right after insertion and whether a transition ran. */
const recordMove = (page: Page, holder: string) =>
  page.evaluate((holder) => {
    const move: { translate: string[]; animated: boolean; entering: boolean } = { translate: [], animated: false, entering: false };
    (window as unknown as { move: typeof move }).move = move;
    const host = document.querySelector(holder)!;
    new MutationObserver(() => {
      const el = host.querySelector<HTMLElement>(".rv-SelectionIndicator");
      if (!el || el.dataset.seen) return;
      el.dataset.seen = "1";
      el.addEventListener("transitionrun", () => (move.animated = true));
      queueMicrotask(() =>
        queueMicrotask(() => {
          move.translate.push(el.style.translate);
          move.entering ||= el.hasAttribute("data-entering");
        }),
      );
    }).observe(host, { childList: true, subtree: true });
  }, holder);

test("selection indicator: server-rendered in the selected tab only, no library JS before interaction", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  const code = sharedElementChunks(page);
  await page.goto(s.origin + "/selection-indicator");
  assert.deepEqual(await holders(page, "#ind-tabs [role=tab]"), ["overview"]);
  assert.deepEqual(await holders(page, "#ind-none [role=tab]"), ["overview"]);
  assert.equal(await page.getAttribute("#ind-tabs-tab-overview .rv-SelectionIndicator", "data-entering"), null);
  assert.equal(await page.getAttribute("#ind-tabs-tab-overview .rv-SelectionIndicator", "class"), "rv-SelectionIndicator");
  // Idle / visible prefetch may bring the Tabs chunk (as on /tabs); the SharedElement code waits for the first change.
  await page.waitForTimeout(1500);
  assert.deepEqual(code, [], "no SharedElement code before interaction");
  await page.click("#ind-tabs-tab-faq");
  await page.waitForFunction(() => document.querySelector("#ind-tabs-tab-faq .rv-SelectionIndicator"));
  // Response bodies are read asynchronously: give the last one a moment.
  for (let i = 0; i < 40 && code.length === 0; i++) await page.waitForTimeout(50);
  assert.equal(code.length, 1, "SharedElement code loads with the first change");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("selection indicator: first click on a resumed page moves the indicator, animating from the server position", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/selection-indicator");
  const from = await page.evaluate(() => document.querySelector("#ind-tabs-tab-overview .rv-SelectionIndicator")!.getBoundingClientRect().left);
  await recordMove(page, "#ind-tabs-tab-specs");
  await page.click("#ind-tabs-tab-specs");
  await page.waitForFunction(() => document.querySelector("#ind-tab-value")?.textContent === "Tab: specs");
  await page.waitForFunction(() => !document.querySelector("#ind-tabs-tab-overview .rv-SelectionIndicator"));
  assert.deepEqual(await holders(page, "#ind-tabs [role=tab]"), ["specs"]);
  const move = await page.evaluate(() => (window as unknown as { move: { translate: string[]; animated: boolean; entering: boolean } }).move);
  const to = await page.evaluate(() => document.querySelector("#ind-tabs-tab-specs")!.getBoundingClientRect().left);
  assert.equal(move.entering, false, "a moved indicator does not enter");
  assert.ok(
    Math.abs(parseFloat(move.translate[0] ?? "") - (from - to)) < 0.5 && from !== to,
    `starts at the server-rendered indicator's place: ${move.translate[0]} vs ${from - to}`,
  );
  await page.waitForFunction(() => (window as unknown as { move: { animated: boolean } }).move.animated);
  await page.waitForFunction(() => document.querySelector<HTMLElement>("#ind-tabs-tab-specs .rv-SelectionIndicator")!.style.translate === "");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("selection indicator: keyboard selection, radio group and toggle buttons follow selection", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/selection-indicator");
  await page.focus("#ind-tabs-tab-overview");
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector("#ind-tab-value")?.textContent === "Tab: specs");
  await page.waitForFunction(() => !document.querySelector("#ind-tabs-tab-overview .rv-SelectionIndicator"));
  assert.deepEqual(await holders(page, "#ind-tabs [role=tab]"), ["specs"]);
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => !document.querySelector("#ind-tabs-tab-specs .rv-SelectionIndicator"));
  assert.deepEqual(await holders(page, "#ind-tabs [role=tab]"), ["faq"]);

  // No transition-property: no snapshot, the next indicator enters.
  await page.click("#ind-none-tab-specs");
  await page.waitForFunction(() => !document.querySelector("#ind-none-tab-overview .rv-SelectionIndicator"));
  assert.deepEqual(await holders(page, "#ind-none [role=tab]"), ["specs"]);

  await page.goto(s.origin + "/selection-indicator-groups");
  assert.deepEqual(await holders(page, "#ind-radio .rv-Radio"), ["Medium"]);
  assert.deepEqual(await holders(page, ".rv-ToggleButton"), []);
  await page.click("#ind-radio .rv-Radio:has-text('Large')");
  await page.waitForFunction(() => !document.querySelector("#ind-radio .rv-Radio:nth-of-type(2) .rv-SelectionIndicator"));
  assert.deepEqual(await holders(page, "#ind-radio .rv-Radio"), ["Large"]);

  await page.click("#ind-bold");
  await page.waitForFunction(() => document.querySelector("#ind-bold .rv-SelectionIndicator"));
  await page.click("#ind-bold");
  await page.waitForFunction(() => !document.querySelector("#ind-bold .rv-SelectionIndicator"));
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("selection indicator inside Tag / GridListItem / Row: server-rendered in the selected item, follows selection", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  const response = await page.goto(s.origin + "/selection-indicator-groups");
  assert.equal(response?.status(), 200);
  for (const id of ["#ind-tags", "#ind-grid", "#ind-table tbody"]) assert.deepEqual(await holders(page, `${id} [role=row]`), ["b"], id);
  for (const id of ["#ind-tags", "#ind-grid", "#ind-table tbody"]) {
    await page.click(`${id} [role=row][data-key=a]`, { position: { x: 4, y: 4 } });
    await page.waitForFunction((id) => document.querySelector(`${id} [role=row][data-key=a] .rv-SelectionIndicator`) != null, id);
    await page.waitForFunction((id) => document.querySelector(`${id} [role=row][data-key=b] .rv-SelectionIndicator`) == null, id);
  }
  assert.deepEqual(seen.errors, []);
  await page.close();
});
