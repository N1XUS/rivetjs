// Card — HeroUI v3.2.6 card.stories.tsx Variants, against the resumed story app.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, nonRuntimeScripts, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

/** Runs `body` on a fresh page, closed even when an assertion throws. */
async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage();
  try {
    await body(page);
  } finally {
    await page.close();
  }
}

const liveClass = (v: string) => `card card--${v} w-[320px]`;

test("card: SSR classes + data-slot per variant, styles applied (non-zero padding), no JS before interaction", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/card");
    for (const v of ["transparent", "default", "secondary", "tertiary"]) assert.equal(await page.getAttribute(`#c-${v}`, "class"), liveClass(v));
    assert.equal(await page.getAttribute("#c-title", "data-slot"), "card-title");
    assert.notEqual(await page.$eval("#c-default", (el) => getComputedStyle(el).paddingTop), "0px");
    await page.waitForLoadState("networkidle");
    assert.deepEqual(nonRuntimeScripts(seen), [], "only runtime entry chunks before interaction");
    assert.deepEqual(seen.errors, []);
  }));

/** Tags the element (an expando on the node): `marked` later tells whether it is still the same node. */
const mark = (page: Page, selector: string) => page.$eval(selector, (el) => void ((el as unknown as Record<string, boolean>).__rvMark = true));
const marked = (page: Page, selector: string) => page.$eval(selector, (el) => (el as unknown as Record<string, boolean>).__rvMark === true);

/** Root + parts after a change to `v`: root class, part classes (CardContext), description text. */
async function expectVariant(page: Page, v: string): Promise<void> {
  await page.waitForFunction((c) => document.querySelector("#c-live")?.getAttribute("class") === c, liveClass(v));
  await page.waitForFunction((t) => document.querySelector("#c-description")?.textContent === t, v);
  assert.equal(await page.getAttribute("#c-title", "class"), "card__title");
  assert.equal(await page.getAttribute("#c-header", "class"), "card__header");
  assert.equal(await page.getAttribute("#c-description", "class"), "card__description");
}

test("card: resumed direct signal prop — the first change updates root + parts", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/card");
    await page.waitForLoadState("networkidle");
    await page.click("#next");
    await expectVariant(page, "secondary");
    // Positive control for the allowlist: the interaction loaded ui / route code.
    assert.ok(nonRuntimeScripts(seen).length > 0, "ui chunks load on interaction: " + seen.scripts.join(","));
    assert.deepEqual(seen.errors, []);
  }));

// Live props (P1/P2 landed, fc7c7bc7): after the first change the Card is a client-created instance with getter props, so
// every later change updates root + parts in place (no re-creation).
test("card: resumed direct signal prop — later changes update root + parts in place (live props)", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/card");
    await page.click("#next");
    await expectVariant(page, "secondary");
    for (const sel of ["#c-live", "#c-header", "#c-title", "#c-description"]) await mark(page, sel);
    for (const v of ["tertiary", "default", "secondary"]) {
      await page.click("#next");
      await expectVariant(page, v);
      for (const sel of ["#c-live", "#c-header", "#c-title", "#c-description"]) assert.ok(await marked(page, sel), `${sel} node kept (${v})`);
    }
    assert.deepEqual(seen.errors, []);
  }));

// Live props P3 (server-resume `_rProps` recipes + member boxes): the server-rendered Card's props are recipes, so the
// FIRST change updates the server-rendered root in place (no re-creation).
test("card: resumed direct signal prop — the first change keeps the server-rendered root (live-props P3)", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/card");
    await mark(page, "#c-live");
    await page.click("#next");
    await expectVariant(page, "secondary");
    assert.ok(await marked(page, "#c-live"), "#c-live server node kept");
  }));
