// Real rendered Scheduler UI: production resume, geometry, live appearance, themed portals and UI controls.
import { test, beforeAll, afterAll } from "vitest";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";
let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());
const shots = resolve(".superpowers/sdd/2026-10-12-scheduler/screenshots");
const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
async function onPage(body: (page: Page) => Promise<void>, width = 1100, hasTouch = false) {
  const page = await s.browser.newPage({ viewport: { width, height: 1100 }, hasTouch });
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

test("scheduler UI: chevrons follow direction independently of language and nearest nested dir wins", () =>
  onPage(async (page) => {
    for (const dir of ["ltr", "rtl"]) {
      for (const lang of ["en", "ar"]) {
        await page.locator("#scheduler-story").evaluate(
          (el, scope) => {
            el.setAttribute("dir", scope.dir);
            el.setAttribute("lang", scope.lang);
          },
          { dir, lang },
        );
        const transform = await css(page, "#agenda .scheduler__navigation .button[aria-label] svg", "transform");
        assert.equal(transform === "matrix(-1, 0, 0, 1, 0, 0)", dir === "rtl", `${dir}/${lang}: ${transform}`);
        assert.equal(await css(page, "#agenda .scheduler__navigation .button:not([aria-label]) svg", "transform"), "none");
        // A direction on the Scheduler itself overrides its ancestor, in either language.
        const inner = dir === "rtl" ? "ltr" : "rtl";
        await page.locator("#agenda").evaluate((el, value) => el.setAttribute("dir", value), inner);
        assert.equal((await css(page, "#agenda .scheduler__navigation .button[aria-label] svg", "transform")) === "matrix(-1, 0, 0, 1, 0, 0)", inner === "rtl");
        await page.locator("#agenda").evaluate((el) => el.removeAttribute("dir"));
      }
    }
  }));

test("scheduler UI: axe per view, selected and hidden-day month, overflow and both menus in light and dark", () =>
  onPage(async (page) => {
    await page.addScriptTag({ content: axeSource });
    const audit = async (state: string) => {
      await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
      const violations = await page.evaluate(async () => {
        const axe = (
          window as unknown as {
            axe: { run(context: object, options: object): Promise<{ violations: { id: string; nodes: { target: string[]; failureSummary?: string }[] }[] }> };
          }
        ).axe;
        // The story shell supplies its own headings/landmarks; all component rules including contrast stay enabled.
        return (
          await axe.run(
            { include: ["#agenda", ".rv-SchedulerMonth-popover", ".rv-SchedulerMenu-popover"] },
            {
              resultTypes: ["violations"],
              rules: { region: { enabled: false } },
            },
          )
        ).violations;
      });
      assert.deepEqual(violations, [], state);
    };
    for (const scheme of ["light", "dark"]) {
      if (scheme === "dark") await page.locator("#dark").click();
      await page.getByRole("radio", { name: "Month", exact: true }).click();
      await audit(`${scheme} month`);
      const cell = page.locator('#agenda [role=gridcell][tabindex="0"]').first();
      await cell.focus();
      await page.keyboard.press("Shift+ArrowRight");
      await page.locator('#agenda [data-selected="true"]').first().waitFor();
      await audit(`${scheme} selected month`);
      await page.keyboard.press("Escape");
      await page.locator("#hidden-days").click();
      await page.waitForFunction(() => document.querySelectorAll("#agenda .rv-SchedulerMonth-weekday:not(.rv-SchedulerMonth-week-header)").length === 5);
      await audit(`${scheme} hidden weekdays`);
      assert.ok(
        await page.locator("#agenda .scheduler__more").count(),
        await page.locator("#agenda").evaluate((el) =>
          JSON.stringify({
            modelCount: document.getElementById("scheduler-event-count")?.textContent,
            label: el.getAttribute("aria-label"),
            title: el.querySelector(".scheduler__title")?.textContent,
            events: [...el.querySelectorAll("[data-rv-event-id]")].map((node) => node.getAttribute("data-rv-event-id")),
            text: el.textContent,
          }),
        ),
      );
      await page.locator("#agenda .scheduler__more").first().click();
      await page.locator(".scheduler__more-panel").waitFor();
      await audit(`${scheme} overflow open`);
      await page.keyboard.press("Escape");
      await page.locator("#agenda .scheduler__cell").first().click({ button: "right" });
      await page.locator(".scheduler__menu").waitFor();
      await audit(`${scheme} slot menu`);
      await page.keyboard.press("Escape");
      await page.locator('#agenda [data-rv-event-id="span"]').first().click({ button: "right" });
      await page.locator(".scheduler__menu").waitFor();
      await audit(`${scheme} event menu`);
      await page.keyboard.press("Escape");
      await page.locator("#hidden-days").click();
      for (const view of ["Week", "Day"]) {
        await page.getByRole("radio", { name: view, exact: true }).click();
        await page.waitForFunction((name) => document.querySelector("#agenda")!.getAttribute("data-view") === name, view.toLowerCase());
        await audit(`${scheme} ${view}`);
      }
    }
  }));

test("scheduler UI: detached overflow and menus inherit the anchor direction independently of language", () =>
  onPage(async (page) => {
    for (const dir of ["rtl", "ltr"]) {
      await page.locator("#scheduler-story").evaluate((el, value) => {
        el.setAttribute("dir", value === "rtl" ? "ltr" : "rtl");
        el.setAttribute("lang", value === "rtl" ? "en" : "ar");
      }, dir);
      await page.locator("#agenda").evaluate((el, value) => el.setAttribute("dir", value), dir);
      await page.locator("#agenda .scheduler__more").first().click();
      await page.locator(".scheduler__more-panel").waitFor();
      assert.equal(await css(page, ".scheduler__more-panel", "direction"), dir, `overflow ${dir}`);
      await page.keyboard.press("Escape");
      await page.locator("#agenda .scheduler__cell").first().click({ button: "right" });
      await page.locator(".scheduler__menu").waitFor();
      assert.equal(await css(page, ".scheduler__menu", "direction"), dir, `menu ${dir}`);
      await page.keyboard.press("Escape");
    }
  }));

test("scheduler UI: warm drag frame layout cost (CDP trace)", () =>
  onPage(async (page) => {
    page.on("pageerror", (error) => console.info("[scheduler-drag-error]", error.stack));
    const chip = page.locator('#agenda [data-rv-event-id="span"]').first();
    const from = (await chip.boundingBox())!;
    const slot = page.locator('#agenda .scheduler__cell[data-rv-day-index="16"]');
    const to = (await slot.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    // Initialization/import is outside the warm frame sample.
    await page.waitForTimeout(200);
    await page.mouse.move(to.x + to.width / 2, to.y + 8, { steps: 8 });
    await page.locator("[data-rv-drag-clone]").waitFor();
    assert.ok(await page.locator('#agenda [data-ghost="true"]').count(), "real layout preview exists before warm frame sampling");
    const ghost = page.locator('#agenda [data-ghost="true"]').first();
    assert.equal(
      await ghost.evaluate((el) => getComputedStyle(el).backgroundColor),
      await chip.evaluate((el) => getComputedStyle(el).backgroundColor),
      "preview preserves the dragged event tone",
    );
    assert.equal(await ghost.evaluate((el) => getComputedStyle(el).borderTopStyle), "dashed");
    assert.equal(await ghost.evaluate((el) => getComputedStyle(el).opacity), "0.9");
    assert.equal(await ghost.evaluate((el) => getComputedStyle(el).pointerEvents), "none");
    assert.equal(await chip.evaluate((el) => getComputedStyle(el).opacity), "0.4");
    const frame = () => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await frame();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    await cdp.send("Tracing.start", {
      categories: "devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing",
      transferMode: "ReturnAsStream",
    });
    const layoutCount = async () => (await cdp.send("Performance.getMetrics")).metrics.find((metric) => metric.name === "LayoutCount")!.value;
    const counts: number[] = [];
    for (let i = 0; i < 12; i++) {
      const before = await layoutCount();
      await page.mouse.move(to.x + to.width / 2 + (i % 2) * to.width, to.y + 60);
      await frame();
      counts.push((await layoutCount()) - before);
    }
    const completed = new Promise<string>((resolve) => cdp.once("Tracing.tracingComplete", (event) => resolve(event.stream!)));
    await cdp.send("Tracing.end");
    const stream = await completed;
    let raw = "";
    for (;;) {
      const chunk = await cdp.send("IO.read", { handle: stream });
      raw += chunk.data;
      if (chunk.eof) break;
    }
    await cdp.send("IO.close", { handle: stream });
    type TraceEvent = { name: string; dur?: number; ts: number; args?: { beginData?: { stackTrace?: unknown[] }; data?: { stackTrace?: unknown[] } } };
    const trace = JSON.parse(raw) as { traceEvents: TraceEvent[] };
    const layouts = trace.traceEvents.filter((event) => event.name === "Layout");
    const forced = layouts.filter((event) => event.args?.beginData?.stackTrace?.length || event.args?.data?.stackTrace?.length);
    const metrics = {
      samples: counts.length,
      layoutPassesPerInputFrame: counts,
      max: Math.max(...counts),
      layoutEvents: layouts.length,
      layoutDurationMs: layouts.reduce((sum, event) => sum + (event.dur ?? 0), 0) / 1000,
      synchronousLayoutWithStack: forced.length,
      layouts,
    };
    writeFileSync(resolve(".superpowers/sdd/2026-10-12-scheduler/task-12-warm-drag-trace.json"), JSON.stringify(metrics, null, 2) + "\n");
    console.info("[scheduler-warm-drag]", JSON.stringify(metrics));
    await page.mouse.up();
    await page.locator("[data-rv-drag-clone]").waitFor({ state: "detached" });
    assert.ok(
      counts.every((count) => count <= 1),
      "at most one layout per warm input frame",
    );
    assert.equal(forced.length, 0, "no synchronous Layout trace with a JavaScript stack during warm pointermove");
    await cdp.detach();
  }));

for (const touch of [false, true]) {
  test(`scheduler UI: resize grip hit strips and hover/focus affordance (touch=${touch})`, () =>
    onPage(
      async (page) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        const chip = page.locator('#agenda [data-rv-event-id="span"]').first();
        const grip = chip.locator(".rv-SchedulerEvent-grip").first();
        assert.equal(await grip.evaluate((el) => getComputedStyle(el).opacity), touch ? "1" : "0");
        for (const handle of await chip.locator(".scheduler__handle").all()) {
          const box = (await handle.boundingBox())!;
          assert.ok(box.width >= 6);
          assert.equal(await handle.evaluate((el) => getComputedStyle(el).touchAction), "none");
        }
        if (!touch) {
          await chip.hover();
          assert.equal(await grip.evaluate((el) => getComputedStyle(el).opacity), "1");
          await page.mouse.move(0, 0);
          await page.keyboard.press("Shift");
          await chip.focus();
          assert.equal(await grip.evaluate((el) => getComputedStyle(el).opacity), "1");
        }
        await page.getByRole("radio", { name: "Week", exact: true }).click();
        await page.waitForFunction(() => document.querySelector("#agenda")?.getAttribute("data-view") === "week");
        const timed = page.locator('#agenda [data-rv-event-id="a"]');
        assert.equal(await timed.evaluate((el) => getComputedStyle(el).position), "absolute");
        assert.equal(
          await timed
            .locator(".scheduler__handle")
            .first()
            .evaluate((el) => getComputedStyle(el).height),
          "6px",
        );
        assert.equal(await css(page, "#agenda .rv-SchedulerTimeGrid-sheet", "user-select"), "none");
        const allDay = page.locator('#agenda .rv-SchedulerTimeGrid-all-day [data-rv-event-id="span"]');
        assert.equal(
          await allDay
            .locator(".scheduler__handle")
            .first()
            .evaluate((el) => (el as HTMLElement).offsetParent === el.parentElement),
          true,
          "positioned lane chip contains its resize handles",
        );
        const bar = (await allDay.boundingBox())!;
        const cell = (await page.locator("#agenda .rv-SchedulerTimeGrid-all-day-cell").first().boundingBox())!;
        assert.ok(bar.width > cell.width * 2.8, "all-day spanning bar uses three complete cell pitches");
        const outside = page.locator('#agenda .scheduler__slot[data-outside-business="true"]').first();
        assert.notEqual(
          await outside.evaluate((el) => getComputedStyle(el).borderBottomColor),
          await outside.evaluate((el) => getComputedStyle(el).backgroundColor),
        );
      },
      1100,
      touch,
    ));
}

test("scheduler UI: selected today retains a distinct month pill and visible all-day selection", () =>
  onPage(async (page) => {
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#agenda .scheduler__title")?.textContent !== "March 2031");
    const today = page.locator('#agenda .scheduler__cell[data-today="true"]');
    assert.equal(
      await today.count(),
      1,
      await page.locator("#agenda").evaluate((el) =>
        JSON.stringify({
          title: el.querySelector(".scheduler__title")?.textContent,
          today: new Date().toISOString(),
          cells: [...el.querySelectorAll("[role=gridcell]")].map((node) => [node.getAttribute("aria-label"), node.getAttribute("data-today")]),
        }),
      ),
    );
    await today.focus();
    await page.keyboard.press("Shift+ArrowRight");
    assert.equal(await today.getAttribute("data-selected"), "true");
    assert.notEqual(
      await today.evaluate((el) => getComputedStyle(el).backgroundColor),
      await today.locator(".rv-SchedulerMonth-day-number").evaluate((el) => getComputedStyle(el).backgroundColor),
    );
    assert.equal(await css(page, "#agenda .rv-SchedulerMonth-grid", "user-select"), "none");
    await page.getByRole("radio", { name: "Week", exact: true }).click();
    const allDay = page.locator('#agenda .rv-SchedulerTimeGrid-all-day-cell[data-today="true"]');
    const before = await allDay.evaluate((el) => getComputedStyle(el).backgroundColor);
    await allDay.focus();
    await page.keyboard.press("Shift+ArrowRight");
    assert.equal(await allDay.getAttribute("data-selected"), "true");
    assert.notEqual(await allDay.evaluate((el) => getComputedStyle(el).backgroundColor), before);
  }));

test("scheduler UI: next/previous and controlled date replace the actual month cells and event geometry", () =>
  onPage(async (page) => {
    const firstCell = page.locator("#agenda .scheduler__cell").first();
    assert.equal(await firstCell.getAttribute("aria-label"), "Monday, February 24, 2031");
    await page.getByRole("button", { name: "Next month", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#agenda .scheduler__cell")?.getAttribute("aria-label") === "Monday, March 31, 2031");
    assert.equal(await page.locator("#agenda .scheduler__title").textContent(), "April 2031");
    assert.equal(await page.locator('#agenda [data-rv-event-id="span"]').count(), 0);
    await page.getByRole("button", { name: "Previous month", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#agenda .scheduler__cell")?.getAttribute("aria-label") === "Monday, February 24, 2031");
    assert.equal(await page.locator('#agenda [data-rv-event-id="span"]').count(), 1);
    await page.locator("#jump-date").click();
    await page.waitForFunction(() => document.querySelector("#agenda .scheduler__cell")?.getAttribute("aria-label") === "Monday, March 31, 2031");
    assert.equal(await page.locator('#agenda [role=gridcell][tabindex="0"]').getAttribute("aria-label"), "Tuesday, April 1, 2031");
    await page.locator("#jump-date").click();
    await page.waitForFunction(() => document.querySelector("#agenda .scheduler__cell")?.getAttribute("aria-label") === "Monday, February 24, 2031");
    assert.equal(
      await page.locator('#agenda [data-rv-event-id="span"]').evaluate((el) => (el as HTMLElement).style.getPropertyValue("--rv-scheduler-span")),
      "3",
    );
  }));

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
