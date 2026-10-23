// Real rendered Scheduler UI: production resume, geometry, live appearance, themed portals and UI controls.
import { test, beforeAll, afterAll } from "vitest";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";
let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());
const shots = resolve(".superpowers/sdd/2026-10-12-scheduler/screenshots");
async function onPage(body: (page: Page) => Promise<void>, width = 1100) {
  const page = await s.browser.newPage({ viewport: { width, height: 1100 } });
  const seen = watch(page);
  try {
    await page.goto(s.origin + "/scheduler");
    await page.waitForLoadState("networkidle");
    await body(page);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
}
const css = (page: Page, sel: string, prop: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
const height = (page: Page, sel: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((el) => el.getBoundingClientRect().height);
const shot = async (page: Page, name: string) => {
  mkdirSync(shots, { recursive: true });
  await page.locator("#scheduler-story").screenshot({ path: resolve(shots, `scheduler-${name}.png`), animations: "disabled" });
};

test("scheduler UI: final month markup, UI toolbar and light screenshot", () =>
  onPage(async (page) => {
    const html = await (await page.request.get(s.origin + "/scheduler")).text();
    assert.doesNotMatch(html, /"fx":\[\[/, "month and UI Segment render without load-time effects");
    assert.equal(await page.locator("[data-boot]").count(), 0);
    assert.equal(await page.locator("#agenda [role=grid]").count(), 1);
    assert.equal(await page.locator("#agenda .scheduler__toolbar .button svg").count(), 3);
    assert.equal(await page.locator("#agenda [data-slot=segment] [role=radio]").count(), 3);
    assert.equal(await css(page, "#agenda .rv-SchedulerMonth-row", "display"), "grid");
    assert.equal(await page.locator("#agenda .rv-SchedulerMonth-week-number").count(), 6);
    const event = await page.locator('#agenda [data-rv-event-id="span"]').first().boundingBox();
    const cell = await page.locator("#agenda .scheduler__cell").first().boundingBox();
    assert.ok(event && cell && event.width > cell.width * 2.8, "three-day spanning event uses three cell pitches");
    assert.equal(await page.locator("#agenda").getAttribute("data-slot"), "scheduler");
    await shot(page, "light");
  }));

test("scheduler UI: live density and surface preserve the root and alter CSS and lane cap", () =>
  onPage(async (page) => {
    await page.locator("#agenda").evaluate((el) => el.setAttribute("data-test-identity", "kept"));
    const normal = await height(page, "#agenda .scheduler__cell");
    await page.locator("#compact").click();
    await page.waitForFunction(() => document.querySelector("#agenda")!.classList.contains("scheduler--compact"));
    assert.equal(await page.locator("#agenda").getAttribute("data-test-identity"), "kept");
    assert.ok((await height(page, "#agenda .scheduler__cell")) < normal);
    assert.equal(await css(page, "#agenda", "--rv-scheduler-lane-height"), "24px");
    assert.equal(await css(page, "#agenda .rv-SchedulerMonth", "--rv-scheduler-visible-lanes"), "3");
    await shot(page, "compact");
    const surface = await css(page, "#agenda", "background-color");
    await page.locator("#secondary").click();
    await page.waitForFunction(() => document.querySelector("#agenda")!.classList.contains("scheduler--secondary"));
    assert.notEqual(await css(page, "#agenda", "background-color"), surface);
    await page.locator("#comfortable").click();
    await page.waitForFunction(() => document.querySelector("#agenda")!.classList.contains("scheduler--comfortable"));
    assert.equal(await css(page, "#agenda .rv-SchedulerMonth", "--rv-scheduler-visible-lanes"), "5");
  }));

test("scheduler UI: localized live toolbar, view segment, navigation and toolbar=false", () =>
  onPage(async (page) => {
    await page.locator("#locale").click();
    await page.getByRole("radio", { name: "Semaine", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#agenda")!.getAttribute("data-view") === "week");
    assert.equal(await height(page, "#agenda .scheduler__slot"), 40);
    assert.equal(await css(page, "#agenda .rv-SchedulerTimeGrid-top", "position"), "sticky");
    const title = await page.locator("#agenda .scheduler__title").textContent();
    await page.locator("#agenda .scheduler__navigation .button[aria-label]").nth(1).click();
    await page.waitForFunction((before) => document.querySelector("#agenda .scheduler__title")!.textContent !== before, title);
    await page.getByRole("radio", { name: "Jour", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#agenda")!.getAttribute("data-view") === "day");
    assert.equal(await page.locator("#agenda [role=listbox]").count(), 1);
    await page.locator("#toolbar").click();
    await page.waitForFunction(() => !document.querySelector("#agenda .scheduler__toolbar"));
    await page.locator("#toolbar").click();
    await page.locator("#agenda .scheduler__toolbar").waitFor();
  }));

test("scheduler UI: dark overflow portal keeps theme and functional classes", () =>
  onPage(async (page) => {
    await page.locator("#dark").click();
    await page.waitForFunction(() => document.querySelector("#scheduler-story")!.getAttribute("data-theme") === "dark");
    await shot(page, "dark");
    await page.locator("#agenda .scheduler__more").first().click();
    const panel = page.locator(".scheduler__more-panel");
    await panel.waitFor();
    assert.ok((await panel.getAttribute("class"))!.includes("first-override"));
    assert.equal(await panel.evaluate((el) => el.closest('[data-theme="dark"]') !== null), true);
    assert.ok(parseFloat(await css(page, ".scheduler__more-panel", "border-top-left-radius")) > 0);
    const event = panel.locator('.scheduler__event[data-color="danger"]');
    assert.equal(await event.count(), 1);
    assert.notEqual(await event.evaluate((el) => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
    await page.keyboard.press("Escape");
    await page.locator("#classes").click();
    await page.locator("#agenda .scheduler__more").first().click();
    await panel.waitFor();
    assert.ok((await panel.getAttribute("class"))!.includes("second-override"));
    await shot(page, "dark-overflow");
  }));

test("scheduler UI: Dropdown menu portal uses UI items, scoped theme and closes on action", () =>
  onPage(async (page) => {
    await page.locator("#dark").click();
    await page.locator("#compact").click();
    await page.locator("#agenda .scheduler__cell").first().click({ button: "right" });
    const menu = page.locator(".scheduler__menu");
    await menu.waitFor();
    assert.ok((await menu.getAttribute("class"))!.includes("dropdown__menu"));
    assert.ok((await menu.getAttribute("class"))!.includes("scheduler--compact"));
    assert.equal(await css(page, ".scheduler__menu .menu-item", "min-height"), "32px");
    assert.equal(await menu.evaluate((el) => el.closest('[data-theme="dark"]') !== null), true);
    assert.ok(await page.locator(".scheduler__menu .menu-item").count());
    await page.getByRole("menuitem", { name: "Create event" }).click();
    await page.waitForFunction(() => document.querySelector("#menu-actions")!.textContent === "1");
    await menu.waitFor({ state: "hidden" });
  }));

test("scheduler UI: RTL logical event placement and compact phone scroll contain", () =>
  onPage(async (page) => {
    await page.locator("#rtl").click();
    await page.waitForFunction(() => document.querySelector("#scheduler-story")!.getAttribute("dir") === "rtl");
    const cells = page.locator("#agenda .scheduler__cell");
    const first = await cells.nth(0).boundingBox();
    const next = await cells.nth(1).boundingBox();
    assert.ok(first && next && first.x > next.x);
    assert.equal(await css(page, "#agenda .scheduler__event", "border-right-width"), "3px");
    await shot(page, "rtl");
    await page.setViewportSize({ width: 375, height: 900 });
    await page.locator("#compact").click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator("#agenda .rv-SchedulerMonth").evaluate((el) => el.scrollWidth > el.clientWidth), true);
  }));

test("scheduler UI: week palette, custom color, now line, inset focus and reduced motion", () =>
  onPage(async (page) => {
    await page.clock.install({ time: new Date("2031-03-04T10:15:00Z") });
    await page.getByRole("radio", { name: "Week", exact: true }).click();
    await page.locator("#agenda .scheduler__now-line").waitFor();
    const backgrounds: string[] = [];
    for (const tone of ["default", "accent", "success", "warning", "danger"])
      backgrounds.push(await css(page, `#agenda .scheduler__event[data-color="${tone}"]`, "background-color"));
    assert.equal(new Set(backgrounds).size, 5, "semantic event surfaces are distinct");
    const custom = page.locator('#agenda .scheduler__event[data-custom-color="true"]');
    assert.equal(await custom.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--rv-scheduler-event-color")), "#8055cf");
    assert.equal(await css(page, "#agenda .scheduler__now-line", "border-top-width"), "2px");
    assert.ok(
      (await height(page, '#agenda [data-rv-event-id="a"] .scheduler__event-time')) <= 20,
      "dense event time stays on one line so its title remains visible",
    );
    const a = await page.locator('#agenda [data-rv-event-id="a"]').boundingBox();
    const b = await page.locator('#agenda [data-rv-event-id="b"]').boundingBox();
    assert.ok(a && b && a.x + a.width <= b.x, "overlapping timed events occupy separate columns");
    const slot = page.locator("#agenda .scheduler__slot").first();
    await slot.focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await css(page, "#agenda .scheduler__slot:focus-visible", "outline-offset"), "-2px");
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await css(page, "#agenda .scheduler__event", "transition-duration"), "0s");
    await shot(page, "week");
  }));
