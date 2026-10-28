// UI-THEME-PORTAL — scoped theme on the overlay layer, resumed story app (`/theme-scope`, `/theme-scope-open`). The test clears every Rivet
// token on `:root` (names read from `styles/themes/scoped.css`), so tokens exist only inside `[data-ui-theme="rivet"]`.
// Overlays portal to `<body>`: the cdk `portalHooks.place` stamp (`src/utils/portal-theme.ts`) copies the trigger's scope
// attributes onto the `[data-rivet-portal]` host → opaque surfaces. Covered: Select, Popover, Tooltip, Modal + a Select
// nested in it, a server-rendered open Tooltip (moved at load), a dark scope (`data-theme`), re-open, and an unscoped
// Popover (no attribute; transparent here = control: the cleared `:root` really empties the tokens).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

const scoped = readFileSync(new URL("../styles/themes/scoped.css", import.meta.url), "utf8");
const names = [...new Set([...scoped.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))];
const CLEAR = `:root, :root.dark, :root[data-theme] { ${names.map((n) => `${n}: initial !important;`).join(" ")} }`;

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>, route = "/theme-scope"): Promise<void> {
  const page = await s.browser.newPage();
  try {
    const seen = watch(page);
    await page.goto(s.origin + route);
    await page.addStyleTag({ content: CLEAR });
    await body(page);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
}

/** The portal host of `selector` (+ its scope attributes) and the computed background of `surface` (closest to it). */
const overlayOf = (page: Page, selector: string, surface: string): Promise<{ hosted: boolean; theme: string | null; mode: string | null; bg: string }> =>
  page.$eval(
    selector,
    (el, surface) => {
      const host = el.closest("[data-rivet-portal]");
      const box = el.closest(surface) ?? el;
      return {
        hosted: !!host && host.parentElement === document.body,
        theme: host?.getAttribute("data-ui-theme") ?? null,
        mode: host?.getAttribute("data-theme") ?? null,
        bg: getComputedStyle(box).backgroundColor,
      };
    },
    surface,
  );

const transparent = (c: string) => c === "transparent" || c === "rgba(0, 0, 0, 0)" || /\/\s*0\)$/.test(c);

async function assertScoped(page: Page, selector: string, surface: string, mode: string | null = null) {
  await page.waitForSelector(selector);
  const o = await overlayOf(page, selector, surface);
  assert.ok(o.hosted, `${selector}: portaled to <body>`);
  assert.equal(o.theme, "rivet", `${selector}: host carries data-ui-theme`);
  assert.equal(o.mode, mode, `${selector}: host data-theme`);
  assert.ok(!transparent(o.bg), `${selector}: opaque surface (${o.bg})`);
  return o;
}

test("theme-scope: control — an unscoped popover gets no attribute (tokens cleared on :root → transparent)", () =>
  onPage(async (page) => {
    await page.click("#ts-out");
    await page.waitForSelector("#ts-out-body");
    const o = await overlayOf(page, "#ts-out-body", "[data-rv-overlay]");
    assert.ok(o.hosted);
    assert.equal(o.theme, null);
    assert.equal(o.mode, null);
    assert.ok(transparent(o.bg), `control background ${o.bg}`);
  }));

test("theme-scope: Select popover inside the scope is stamped + opaque; re-open stamps the new host", () =>
  onPage(async (page) => {
    await page.click("#ts-select");
    await assertScoped(page, "[role=listbox]", "[data-rv-overlay]");
    await page.keyboard.press("Escape");
    await page.waitForSelector("[role=listbox]", { state: "detached" });
    await page.click("#ts-select");
    await assertScoped(page, "[role=listbox]", "[data-rv-overlay]");
  }));

test("theme-scope: Popover + Tooltip inside the scope", () =>
  onPage(async (page) => {
    await page.click("#ts-po");
    await assertScoped(page, "#ts-po-body", "[data-rv-overlay]");
    await page.keyboard.press("Escape");
    await page.waitForSelector("#ts-po-body", { state: "detached" });
    // Escape left the keyboard modality; a real pointer moves before it enters the trigger (RA useTooltipTrigger shows on
    // hover only in the pointer modality, and a one-step jump dispatches pointerenter before its pointermove).
    await page.mouse.move(1, 1);
    await page.hover("#ts-tt");
    await assertScoped(page, "#ts-tt-tip", "[role=tooltip]");
  }));

test("theme-scope: Modal inside the scope, and a Select nested in it inherits through the stamped host", () =>
  onPage(async (page) => {
    await page.click("#ts-mo");
    await assertScoped(page, "#ts-mo-dialog", "#ts-mo-dialog");
    await page.click("#ts-nested");
    await assertScoped(page, "[role=listbox]", "[data-rv-overlay]");
  }));

test("theme-scope: server-rendered open Tooltip (moved at load) is stamped", () =>
  onPage(async (page) => {
    await page.waitForFunction(() => document.querySelector("#ts-open-tip")?.closest("[data-rivet-portal]")?.parentElement === document.body);
    await assertScoped(page, "#ts-open-tip", "[role=tooltip]");
  }, "/theme-scope-open"));

test("theme-scope: dark scope copies data-theme; the surface differs from the light scope's", () =>
  onPage(async (page) => {
    await page.click("#ts-po");
    const light = await assertScoped(page, "#ts-po-body", "[data-rv-overlay]");
    await page.keyboard.press("Escape");
    await page.waitForSelector("#ts-po-body", { state: "detached" });
    await page.click("#ts-dpo");
    const dark = await assertScoped(page, "#ts-dpo-body", "[data-rv-overlay]", "dark");
    assert.notEqual(dark.bg, light.bg);
  }));
