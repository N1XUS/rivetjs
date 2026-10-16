// Accordion — resumed story app (`/accordion`): SSR markup; upstream keyboard case on a real keyboard (focus the first
// trigger, Enter expands, Space collapses); mouse on the resumed page (single expansion, `onExpandedChange` keys, panel
// height animates to the content and back (HeroUI CSS), disabled item); upstream accordion.browser.test.tsx: custom
// `hover:bg-surface` wins over the default hover background, a stale `data-hovered` paints no hover background, the default
// hover background follows the pointer (default + surface variants); Rivet: the hover background eases (transition on the same
// resumed trigger node).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 900 } });
  try {
    const seen = watch(page);
    await page.goto(s.origin + "/accordion");
    await page.waitForLoadState("networkidle");
    await body(page);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
}

const trigger = (n: number, acc = "acc") => `#${acc} [data-slot=accordion-item]:nth-child(${n}) [data-slot=accordion-trigger]`;
const panel = (n: number) => `#acc [data-slot=accordion-item]:nth-child(${n}) [data-slot=accordion-panel]`;
const settled = (page: Page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
const height = (page: Page, sel: string) => page.locator(sel).evaluate((el) => el.getBoundingClientRect().height);
const bg = (page: Page, sel: string) => page.locator(sel).evaluate((el) => getComputedStyle(el).backgroundColor);
const unhover = (page: Page) => page.mouse.move(990, 890);

test("accordion: SSR markup", async () => {
  const page = await s.browser.newPage();
  try {
    const html = await (await page.request.get(s.origin + "/accordion")).text();
    assert.match(html, /data-slot="accordion"/);
    assert.match(html, /class="accordion accordion--surface"|class="accordion--surface accordion"/);
    assert.match(html, /class="accordion__trigger/);
    assert.doesNotMatch(html, /aria-expanded="true"/);
  } finally {
    await page.close();
  }
});

test("accordion: keyboard Tab / Enter / Space (upstream)", () =>
  onPage(async (page) => {
    // The story layout's links precede the accordion: focus the first trigger (upstream: user.tab()).
    await page.locator(trigger(1)).focus();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "How do I place an order?");
    await page.keyboard.press("Enter");
    await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute("aria-expanded") === "true", trigger(1));
    await page.keyboard.press(" ");
    await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute("aria-expanded") === "false", trigger(1));
  }));

test("accordion: mouse on the resumed page (single expansion, keys, animated panel, disabled)", () =>
  onPage(async (page) => {
    assert.equal(await height(page, panel(1)), 0);
    await page.click(trigger(1));
    await page.waitForFunction(() => document.querySelector("#acc-keys")?.textContent === "faq-1");
    await settled(page);
    assert.ok((await height(page, panel(1))) > 10, "panel expanded to its content");
    assert.equal(await page.getAttribute(panel(1), "data-expanded"), "true");
    await page.click(trigger(2));
    await page.waitForFunction(() => document.querySelector("#acc-keys")?.textContent === "faq-2");
    await settled(page);
    assert.equal(await height(page, panel(1)), 0);
    assert.equal(await page.getAttribute(trigger(1), "aria-expanded"), "false");
    assert.equal(await page.isDisabled(trigger(3)), true);
  }));

test("accordion: custom hover background wins over the default one (upstream browser)", () =>
  onPage(async (page) => {
    await page.hover("#acc-custom [data-slot=accordion-trigger]");
    // Rivet: the hover background eases (150 ms, TWEAKS.md): wait for the settled colour instead of a fixed 50 ms.
    const probe = await bg(page, "#surface-probe");
    await page.waitForFunction(
      ([s, p]) => getComputedStyle(document.querySelector(s!)!).backgroundColor === p,
      ["#acc-custom [data-slot=accordion-trigger]", probe],
    );
    assert.equal(await bg(page, "#acc-custom [data-slot=accordion-trigger]"), probe);
  }));

test("accordion: hover background eases on the resumed trigger (no snap), node kept", () =>
  onPage(async (page) => {
    // `#acc-hover-*` fixtures opt out (`transition-none`, upstream): use a collapsed trigger of `#acc`.
    const sel = "#acc [data-slot=accordion-trigger][aria-expanded=false]:not(:disabled)";
    await unhover(page);
    await settled(page);
    assert.match(
      await page
        .locator(sel)
        .first()
        .evaluate((el) => getComputedStyle(el).transitionProperty),
      /background-color/,
    );
    await page
      .locator(sel)
      .first()
      .evaluate((el) => ((el as HTMLElement & { mark?: number }).mark = 1));
    await page.hover(sel);
    await page.waitForFunction(
      (s) =>
        document
          .getAnimations()
          .some(
            (a) =>
              a instanceof CSSTransition && a.transitionProperty === "background-color" && (a.effect as KeyframeEffect).target === document.querySelector(s),
          ),
      sel,
    );
    assert.equal(
      await page
        .locator(sel)
        .first()
        .evaluate((el) => (el as HTMLElement & { mark?: number }).mark),
      1,
    );
  }));

for (const acc of ["acc-hover-default", "acc-hover-surface"])
  test(`accordion: stale data-hovered paints no hover background, the pointer does (${acc}, upstream browser)`, () =>
    onPage(async (page) => {
      const sel = `#${acc} [data-slot=accordion-trigger]`;
      await unhover(page);
      const resting = await bg(page, sel);
      await page.locator(sel).evaluate((el) => el.setAttribute("data-hovered", "true"));
      assert.equal(await bg(page, sel), resting);
      await page.locator(sel).evaluate((el) => el.removeAttribute("data-hovered"));
      await page.hover(sel);
      await page.waitForFunction(([s, r]) => getComputedStyle(document.querySelector(s!)!).backgroundColor !== r, [sel, resting]);
      await unhover(page);
      await page.waitForFunction(([s, r]) => getComputedStyle(document.querySelector(s!)!).backgroundColor === r, [sel, resting]);
    }));
