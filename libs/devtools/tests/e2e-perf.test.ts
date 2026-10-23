// Performance indicators end to end on the Vite dev server (a copy of the router fixture with a page
// that provokes a layout shift and forced reflows, driven in Chromium): the findings name the
// responsible component, the tree shows a badge, interactions are listed.
import { test } from "vitest";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";

const fixture = new URL("../../router/tests/fixture/", import.meta.url).pathname;
const PAGE = `import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";

// Inserts a block above the gallery well after load (no recent input): the gallery moves.
function Promo() {
  const shown = signal(false);
  clientEffect(() => {
    const timer = setTimeout(() => shown.set(true), 1500);
    return () => clearTimeout(timer);
  });
  return (
    <div id="promo-slot">
      {() =>
        shown() ? (
          <div id="promo">
            <p>Sale</p>
            <p>Everything must go</p>
            <p>Today only</p>
          </div>
        ) : null
      }
    </div>
  );
}
function Gallery() {
  return (
    <section id="gallery">
      <p class="tile">One</p>
      <p class="tile">Two</p>
      <p class="tile">Three</p>
      <p class="tile">Four</p>
    </section>
  );
}
// A handler that writes, then reads layout (forced reflow in an event handler).
function Measure() {
  const width = signal(0);
  return (
    <div>
      <div id="box">box</div>
      <button
        type="button"
        id="measure"
        onClick={() => {
          const box = document.getElementById("box")!;
          box.textContent = "box " + Math.random();
          width.set(box.offsetWidth);
        }}
      >
        Measure {width()}
      </button>
    </div>
  );
}
// An effect that writes, then reads layout (forced reflow inside a framework run).
function Sizer() {
  const n = signal(0);
  clientEffect(() => {
    const size = n();
    const el = document.getElementById("sized");
    if (!el || !size) return;
    el.textContent = "sized " + size;
    void el.getBoundingClientRect();
  });
  return (
    <div>
      <p id="sized">sized</p>
      <button type="button" id="grow" onClick={() => n.update((v) => v + 1)}>
        Grow
      </button>
    </div>
  );
}
export default function PerfPage() {
  return (
    <main id="perf">
      <Promo />
      <Gallery />
      <Measure />
      <Sizer />
    </main>
  );
}
`;

test("Performance tab: a layout shift and forced reflows name their components; tree badges; interactions", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/devtools-e2e-"));
  await cp(fixture, root, { recursive: true, filter: (path) => !/[/\\](\.rivet|dist|node_modules)$/.test(path) });
  await writeFile(resolve(root, "src/routes/perf.tsx"), PAGE);
  const server = await createServer({ root, configFile: resolve(root, "vite.config.ts"), logLevel: "silent", server: { port: 0 } });
  await server.listen();
  const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 1400 } })).newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(origin + "/perf");
    await page.locator("#gallery").waitFor();
    // Open the panel right away (an input), well before the promo lands (shifts within 500 ms of input don't count).
    await page.keyboard.press("Alt+Shift+R");
    const panel = page.frameLocator("rivet-devtools iframe");
    await panel.locator(".tabs").waitFor();
    await page.locator("#promo").waitFor();
    await panel.locator('[data-tab="performance"]').click();
    const pane = panel.locator(".perf-pane");

    // Layout shift: attributed to the gallery, whose nodes moved.
    const shift = pane.locator('li.finding[data-kind="layout-shift"]').first();
    await shift.waitFor();
    assert.ok(await shift.locator('.comp-link[data-comp="Gallery"]').count(), "the shift names <Gallery>");
    assert.notEqual(await pane.locator(".metric.cls .value").textContent(), "0.000");
    await shift.locator(".hint summary").click();
    await shift.locator(".hint a[href='https://web.dev/articles/cls']").waitFor();

    // Forced reflow in a handler: off by default, enabled from the panel.
    assert.equal(await pane.locator(".reflow-toggle").isChecked(), false);
    await page.click("#measure");
    await page.waitForTimeout(300);
    assert.equal(await pane.locator('li.finding[data-kind="forced-reflow"]').count(), 0, "no detection while off");
    await pane.locator(".reflow-toggle").check();
    await page.click("#measure");
    const handler = pane.locator('li.finding[data-kind="forced-reflow"]', { has: panel.locator('.comp-link[data-comp="Measure"]') });
    await handler.waitFor();
    assert.equal(await handler.locator(".title").textContent(), "Forced reflow: offsetWidth");
    assert.match((await handler.locator(".detail").textContent()) ?? "", /inside an event handler of <Measure>/);
    assert.match((await handler.locator(".finding-head .location").textContent()) ?? "", /perf\.tsx:\d+/);

    // Forced reflow inside an effect run: attributed to the component owning the effect.
    await page.click("#grow");
    const inEffect = pane.locator('li.finding[data-kind="forced-reflow"]', { has: panel.locator('.comp-link[data-comp="Sizer"]') });
    await inEffect.waitFor();
    assert.equal(await inEffect.locator(".title").textContent(), "Forced reflow: getBoundingClientRect");
    assert.match((await inEffect.locator(".detail").textContent()) ?? "", /inside an effect or binding of <Sizer>/);

    // Per-component table and interactions.
    await pane.locator('.perf-table tr[data-name="Gallery"] td.cls').filter({ hasNotText: "—" }).waitFor();
    // Two Measure rows: the instance the resumed page adopted (its `clientEffect` booted it) and the client render's (the
    // panel's Components tab switched the page); the handler's reflow counts on the live one.
    await pane.locator('.perf-table tr[data-name="Measure"] td.reflows', { hasText: /^1$/ }).waitFor();
    await pane
      .locator('.interactions tbody tr[data-type="click"]', { has: panel.locator('.comp-link[data-comp="Measure"]') })
      .first()
      .waitFor();
    await page.screenshot({ path: ".artifacts/devtools-perf.png" });

    // Sorting by a column.
    await pane.locator('th[data-sort="reflows"]').click();
    const first = await pane.locator(".perf-table:not(.interactions) tbody tr").first().getAttribute("data-name");
    assert.ok(first === "Measure" || first === "Sizer", "most reflows first: " + first);

    // Badges on the component tree, with the reason; a click opens the tab filtered by the component.
    await panel.locator('[data-tab="components"]').click();
    const badge = panel.locator('.row[data-name="Gallery"] .perf-badge');
    await badge.waitFor();
    assert.match((await badge.getAttribute("title")) ?? "", /layout shift 0\.\d{3}/);
    await page.screenshot({ path: ".artifacts/devtools-perf-badges.png" });
    await panel.locator('.row[data-name="Measure"] .perf-badge').click();
    await pane.locator(".clear-focus", { hasText: "Only <Measure>" }).waitFor();
    // Only findings naming <Measure> (its reflow; also the shift that moved it, chunks after its click).
    const named = await pane
      .locator("li.finding")
      .evaluateAll((items) => items.map((li) => [li.getAttribute("data-kind"), !!li.querySelector('.comp-link[data-comp="Measure"]')]));
    assert.ok(named.length > 0 && named.every(([, has]) => has), JSON.stringify(named));
    assert.ok(named.some(([kind]) => kind === "forced-reflow"));

    // The toggle is off again after unchecking (the patch is removed).
    await pane.locator(".clear-focus").click();
    await pane.locator(".reflow-toggle").uncheck();
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
