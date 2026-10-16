// ProgressBar / ProgressCircle / Meter — HeroUI v3.2.6 stories against the resumed story app (`/progress`): SSR markup + classes + CSS,
// JS before interaction, live `value={value()}` / `isIndeterminate={…}` / `color={…}` on a resumed page.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { progressBarVariants } from "../styles/src/components/progress-bar/index.ts";
import { progressCircleVariants } from "../styles/src/components/progress-circle/index.ts";
import { meterVariants } from "../styles/src/components/meter/index.ts";
import { stories, watch, nonRuntimeScripts, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

async function onPage(body: (page: Page) => Promise<void>): Promise<void> {
  const page = await s.browser.newPage();
  try {
    await body(page);
  } finally {
    await page.close();
  }
}

/** Tags the element (an expando on the node): `marked` later tells whether it is still the same node. */
const mark = (page: Page, selector: string) => page.$eval(selector, (el) => void ((el as unknown as Record<string, boolean>).__rvMark = true));
const marked = (page: Page, selector: string) => page.$eval(selector, (el) => (el as unknown as Record<string, boolean>).__rvMark === true);

const C = 2 * Math.PI * 16;
const width = (page: Page, sel: string) => page.$eval(sel, (el) => (el as HTMLElement).style.width);
const offset = (page: Page, sel: string) => page.$eval(sel, (el) => Number(el.getAttribute("stroke-dashoffset")));

test("progress: SSR markup, classes per story, CSS applied; no ui JS before interaction", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/progress");
    for (const size of ["sm", "md", "lg"] as const) assert.equal(await page.getAttribute(`#pb-size-${size}`, "class"), progressBarVariants({ size }).base());
    for (const color of ["default", "accent", "success", "warning", "danger"] as const) {
      assert.equal(await page.getAttribute(`#pb-color-${color}`, "class"), progressBarVariants({ color }).base());
      assert.equal(await page.getAttribute(`#pc-color-${color}`, "class"), progressCircleVariants({ color }).base());
    }
    assert.equal(await page.getAttribute("#m-default", "class"), meterVariants({}).base());
    assert.equal(await page.getAttribute("#pb-default", "role"), "progressbar");
    assert.equal(await page.getAttribute("#m-default", "role"), "meter");
    assert.equal(await page.textContent("#pb-default [data-slot=progress-bar-output]"), "60%");
    assert.equal(await page.textContent("#pb-custom [data-slot=progress-bar-output]"), "$750.00");
    assert.equal(await page.textContent("#m-custom [data-slot=meter-output]"), "$750.00");
    assert.equal(await width(page, "#pb-default [data-slot=progress-bar-fill]"), "60%");
    assert.equal(await width(page, "#pb-indeterminate [data-slot=progress-bar-fill]"), "");
    assert.equal(await page.getAttribute("#pb-indeterminate", "aria-valuenow"), null);
    assert.ok(Math.abs((await offset(page, "#pc-default [data-slot=progress-circle-fill-circle]")) - 0.4 * C) < 1e-6);
    assert.ok(Math.abs((await offset(page, "#pc-indeterminate [data-slot=progress-circle-fill-circle]")) - 0.75 * C) < 1e-6);
    // HeroUI CSS reached the parts (track has a height, the fill a background).
    assert.notEqual(await page.$eval("#pb-default [data-slot=progress-bar-track]", (el) => getComputedStyle(el).height), "0px");
    assert.notEqual(await page.$eval("#m-default [data-slot=meter-fill]", (el) => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
    await page.waitForLoadState("networkidle");
    assert.deepEqual(nonRuntimeScripts(seen), [], "only runtime entry chunks before interaction");
    assert.deepEqual(seen.errors, []);
  }));

// Live props (P1/P2): every change updates fill width / output / ring in place. The FIRST change on a resumed page re-creates the
// component region (live-props P3 resume recipes not landed: card.test.ts `test.fails`), so node identity is asserted from the second
// change on.
test("progress: resumed live value — bar fill + output, ring offset, meter follow every change; nodes kept after the first", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/progress");
    assert.equal(await width(page, "#pb-live-fill"), "25%");
    let first = true;
    for (const v of [50, 75, 100, 25]) {
      await page.click("#p-next");
      await page.waitForFunction(([sel, w]) => (document.querySelector(sel) as HTMLElement | null)?.style.width === w, ["#pb-live-fill", `${v}%`] as const);
      assert.equal(await page.textContent("#pb-live-output"), `${v}%`);
      assert.equal(await page.getAttribute("#pb-live", "aria-valuenow"), String(v));
      await page.waitForFunction(([sel, w]) => (document.querySelector(sel) as HTMLElement | null)?.style.width === w, ["#m-live-fill", `${v}%`] as const);
      assert.equal(await page.textContent("#m-live-output"), `${v}%`);
      assert.ok(Math.abs((await offset(page, "#pc-live-fill")) - (C - (v / 100) * C)) < 1e-6, `ring at ${v}`);
      const nodes = ["#pb-live", "#pb-live-fill", "#pb-live-output", "#pc-live-fill", "#m-live-fill"];
      if (first) first = false;
      else for (const sel of nodes) assert.ok(await marked(page, sel), `${sel} kept (${v})`);
      for (const sel of nodes) await mark(page, sel);
    }
    assert.deepEqual(seen.errors, []);
  }));

test("progress: resumed live isIndeterminate + color toggle both ways", () =>
  onPage(async (page) => {
    const seen = watch(page);
    await page.goto(s.origin + "/progress");
    await page.click("#p-ind");
    await page.waitForFunction(() => document.querySelector("#pb-live")?.getAttribute("aria-valuenow") === null);
    assert.equal(await width(page, "#pb-live-fill"), "");
    await page.waitForFunction((o) => Math.abs(Number(document.querySelector("#pc-live-fill")?.getAttribute("stroke-dashoffset")) - o) < 1e-6, 0.75 * C);
    await page.click("#p-ind");
    await page.waitForFunction(() => (document.querySelector("#pb-live-fill") as HTMLElement | null)?.style.width === "25%");
    await page.click("#p-color");
    await page.waitForFunction((c) => document.querySelector("#pb-live")?.getAttribute("class") === c, progressBarVariants({ color: "danger" }).base());
    await page.waitForFunction((c) => document.querySelector("#pc-live")?.getAttribute("class") === c, progressCircleVariants({ color: "danger" }).base());
    await page.click("#p-color");
    await page.waitForFunction((c) => document.querySelector("#pb-live")?.getAttribute("class") === c, progressBarVariants({ color: "accent" }).base());
    assert.deepEqual(seen.errors, []);
  }));
