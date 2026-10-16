// UI-POLISH (2026-10-08): the FIRST selection change of Tabs / Segment animates the indicator from the previous item
// (cdk SharedElement: snapshot of the old indicator, the new one starts at its place and transitions `translate`), on the
// resumed page (server-rendered indicator) and on a client-created pair (`#si-mount`), in the production story build and on
// the dev server (`vite serve`, development condition). Was (dev only): the dev runtime gives every component its own
// owner, so `_serverBranch()` (dom-adopt `direct`) saw no server branch under the ui `Tabs.Indicator` wrapper → the old
// indicator was dropped without a snapshot and the new one "entered" (no movement).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { stories, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const INDICATOR = "[data-slot=tabs-indicator], [data-slot=segment-indicator]";

/** Click the `index`-th item of `root` and record the indicator that moves in: transitions it runs, entering, start translate. */
async function firstChange(page: Page, root: string, item: string, index: number): Promise<void> {
  await page.evaluate(
    ([root, selector]) => {
      const record = { run: [] as string[], entering: false, translate: [] as string[] };
      (window as unknown as { si: typeof record }).si = record;
      const host = document.querySelector(root)!;
      host.addEventListener(
        "transitionrun",
        (event) => (event.target as Element).matches(selector) && record.run.push((event as TransitionEvent).propertyName),
        true,
      );
      new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "attributes" && (m.target as Element).matches(selector) && (m.target as Element).hasAttribute("data-entering")) record.entering = true;
          for (const n of m.addedNodes)
            if (n instanceof HTMLElement && n.matches(selector)) {
              if (n.hasAttribute("data-entering")) record.entering = true;
              queueMicrotask(() => queueMicrotask(() => record.translate.push(n.style.translate)));
            }
        }
      }).observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-entering"] });
    },
    [root, INDICATOR] as const,
  );
  const target = `${root} ${item}:nth-of-type(${index})`;
  await page.click(target);
  await page.waitForFunction(([target, selector]) => document.querySelector(target)?.querySelector(selector) != null, [target, INDICATOR] as const);
  await page.waitForFunction(() => (window as unknown as { si: { run: string[] } }).si.run.includes("translate"), undefined, { timeout: 3000 }).catch(() => {});
  const record = await page.evaluate(() => (window as unknown as { si: { run: string[]; entering: boolean; translate: string[] } }).si);
  assert.ok(record.run.includes("translate"), `${root}: first change runs a translate transition (${JSON.stringify(record)})`);
  assert.equal(record.entering, false, `${root}: the moved indicator does not enter`);
  assert.ok(
    record.translate.some((t) => t !== "" && parseFloat(t) !== 0),
    `${root}: starts at the previous indicator (${record.translate})`,
  );
  assert.equal(await page.locator(`${root} :is(${INDICATOR})`).count(), 1, `${root}: one indicator`);
}

async function checkPage(browser: Browser, origin: string): Promise<string[]> {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(origin + "/selection-indicator");
    await page.waitForLoadState("networkidle");
    // Resumed: indicators server-rendered under the first item.
    assert.equal(await page.locator("#si-tabs [role=tab]:nth-of-type(1) [data-slot=tabs-indicator]").count(), 1);
    assert.equal(await page.locator("#si-seg [role=radio]:nth-of-type(1) [data-slot=segment-indicator]").count(), 1);
    await firstChange(page, "#si-tabs", "[role=tab]", 2);
    await firstChange(page, "#si-seg", "[role=radio]", 3);
    // Client-created pair.
    await page.click("#si-mount");
    await page.waitForSelector("#si-tabs-c [role=tab]:nth-of-type(1) [data-slot=tabs-indicator]", { state: "attached" });
    await page.waitForSelector("#si-seg-c [role=radio]:nth-of-type(1) [data-slot=segment-indicator]", { state: "attached" });
    await firstChange(page, "#si-tabs-c", "[role=tab]", 3);
    await firstChange(page, "#si-seg-c", "[role=radio]", 2);
  } finally {
    await page.close();
  }
  return errors;
}

test("production: first Tabs / Segment change animates the indicator (resumed + client-created)", async () => {
  assert.deepEqual(await checkPage(s.browser, s.origin), []);
});

test("dev server: first Tabs / Segment change animates the indicator (resumed + client-created)", async () => {
  const root = new URL("./app/", import.meta.url).pathname;
  const saved = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  const server = await createServer({ root, configFile: root + "vite.config.ts", logLevel: "silent", server: { port: 0 } });
  await server.listen();
  const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch({ headless: true });
  try {
    assert.deepEqual(await checkPage(browser, origin), []);
  } finally {
    await browser.close();
    await server.close();
    if (saved === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved;
  }
});
