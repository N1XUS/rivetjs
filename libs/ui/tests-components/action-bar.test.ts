// ActionBar — resumed story app (`/action-bar`; Rivet-authored, feature set inspired by HeroUI Pro's public ActionBar docs):
// SSR markup (fixed layer + hidden toolbar pill; the bar adds no client effect — the page's ListBox / Button preload their
// chunks, so no "no boot" gate here); a ListBox selection opens the bar (CSS enter
// transition, bottom-centre, pill takes pointer events, layer does not), the polite prefix count follows the selection,
// actions press, arrow keys move between the actions, clearing the selection closes it (exit transition → `display: none`);
// opening is announced by an always-mounted polite region outside the hidden pill;
// reduced motion: no transition; < 640 px the labels are screen-reader-only (icon-only buttons).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>, width = 1000, reducedMotion: "reduce" | "no-preference" = "no-preference"): Promise<void> {
  const page = await s.browser.newPage({ viewport: { width, height: 700 }, reducedMotion });
  try {
    await body(page);
  } finally {
    await page.close();
  }
}

const pill = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector<HTMLElement>("#ab [role=toolbar]")!;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      display: cs.display,
      opacity: cs.opacity,
      pointer: cs.pointerEvents,
      transition: cs.transitionDuration,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
    };
  });

test("action-bar: SSR markup, closed, fixed layer", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/action-bar");
    assert.equal(await page.getAttribute("#ab", "class"), "action-bar action-bar--horizontal");
    assert.equal(await page.getAttribute("#ab", "data-open"), null);
    assert.equal(await page.getAttribute("#ab [role=toolbar]", "aria-label"), "Actions");
    assert.equal(await page.getAttribute("#ab [data-slot=action-bar-prefix]", "aria-live"), "polite");
    assert.equal((await pill(page)).display, "none");
    const layer = await page.evaluate(
      () => getComputedStyle(document.getElementById("ab")!).position + " " + getComputedStyle(document.getElementById("ab")!).pointerEvents,
    );
    assert.equal(layer, "fixed none");
    await page.waitForLoadState("networkidle");
    assert.deepEqual(seen.errors, []);
  }));

test("action-bar: selection opens it (enter transition), count follows, actions, arrow keys, clear closes", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/action-bar");
    await page.click("#lb [role=option] >> nth=0");
    await page.waitForFunction(() => document.getElementById("ab")!.getAttribute("data-open") === "true");
    assert.equal(await page.textContent("#ab-count"), "1");
    // Mid-transition the pill is visible but not yet opaque; it settles.
    await page.waitForFunction(() => getComputedStyle(document.querySelector("#ab [role=toolbar]")!).opacity === "1", undefined, { timeout: 2000 });
    const open = await pill(page);
    assert.notEqual(open.display, "none");
    assert.equal(open.pointer, "auto");
    assert.ok(Math.abs((open.left + open.right) / 2 - 500) < 2, `centred (${open.left}–${open.right})`);
    assert.ok(open.bottom > 600 && open.bottom < 700, `near the bottom (${open.bottom})`);
    assert.notEqual(open.transition, "0s");
    await page.click("#lb [role=option] >> nth=2");
    await page.waitForFunction(() => document.getElementById("ab-count")!.textContent === "2");
    await page.click("#ab-archive");
    await page.waitForFunction(() => document.getElementById("ab-archived")!.textContent === "1");
    await page.focus("#ab-archive");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "ab-delete");
    await page.click("#ab-clear");
    await page.waitForFunction(() => !document.getElementById("ab")!.hasAttribute("data-open"));
    await page.waitForFunction(() => getComputedStyle(document.querySelector("#ab [role=toolbar]")!).display === "none", undefined, { timeout: 2000 });
    assert.equal(await page.locator("#lb [aria-selected=true]").count(), 0);
    assert.deepEqual(seen.errors, []);
  }));

// React Spectrum ActionBar announces "Actions available." on open. The Prefix live region sits in the pill, which is
// `display: none` while closed (outside the accessibility tree), so its first text is never announced: the bar keeps an
// always-mounted polite region outside the pill whose text binding switches on open.
test("action-bar: opening is announced by an always-mounted polite live region", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/action-bar");
    const announcer = "#ab [data-slot=action-bar-announcer]";
    const state = () =>
      page.evaluate((sel) => {
        const el = document.querySelector<HTMLElement>(sel)!;
        return {
          live: el.getAttribute("aria-live"),
          atomic: el.getAttribute("aria-atomic"),
          inPill: !!el.closest("[role=toolbar]"),
          rendered: el.checkVisibility(),
          text: el.textContent,
        };
      }, announcer);
    assert.deepEqual(await state(), { live: "polite", atomic: "true", inPill: false, rendered: true, text: "" });
    // In the accessibility tree while closed (a live region must exist before its content changes).
    const cdp = await page.context().newCDPSession(page);
    const { root } = (await cdp.send("DOM.getDocument")) as { root: { nodeId: number } };
    const { nodeId } = (await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: announcer })) as { nodeId: number };
    const { nodes } = (await cdp.send("Accessibility.getPartialAXTree", { nodeId, fetchRelatives: false })) as { nodes: { ignored: boolean }[] };
    assert.equal(nodes[0]!.ignored, false);
    await page.click("#lb [role=option] >> nth=0");
    await page.waitForFunction((sel) => document.querySelector(sel)!.textContent === "Actions available.", announcer);
    assert.equal((await state()).rendered, true);
    await page.click("#ab-clear");
    await page.waitForFunction((sel) => document.querySelector(sel)!.textContent === "", announcer);
    assert.deepEqual(seen.errors, []);
  }));

test("action-bar: reduced motion jumps (no transition)", () =>
  onPage(
    async (page) => {
      await page.goto(s.origin + "/action-bar");
      await page.click("#lb [role=option] >> nth=0");
      await page.waitForFunction(() => document.getElementById("ab")!.getAttribute("data-open") === "true");
      const p = await pill(page);
      assert.equal(p.transition, "0s");
      assert.equal(p.opacity, "1");
    },
    1000,
    "reduce",
  ));

test("action-bar: labels are screen-reader-only below 640 px", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/action-bar");
    await page.click("#lb [role=option] >> nth=0");
    await page.waitForFunction(() => document.getElementById("ab")!.getAttribute("data-open") === "true");
    const w = await page.evaluate(() => document.querySelector<HTMLElement>("#ab-archive .action-bar__label")!.getBoundingClientRect().width);
    assert.ok(w <= 1, `label width ${w}`);
    assert.equal(await page.getAttribute("#ab-archive", "aria-label"), null);
    assert.equal((await page.textContent("#ab-archive"))?.trim(), "Archive");
  }, 500));

test("action-bar: label visible at 1000 px", () =>
  onPage(async (page) => {
    await page.goto(s.origin + "/action-bar");
    await page.click("#lb [role=option] >> nth=0");
    await page.waitForFunction(() => document.getElementById("ab")!.getAttribute("data-open") === "true");
    const w = await page.evaluate(() => document.querySelector<HTMLElement>("#ab-archive .action-bar__label")!.getBoundingClientRect().width);
    assert.ok(w > 20, `label width ${w}`);
  }));
