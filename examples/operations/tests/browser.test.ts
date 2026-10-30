import { beforeAll, afterAll, test, expect } from "vitest";
import assert from "node:assert/strict";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { startApp, type AppFixture } from "./_support.ts";
let app: AppFixture;
let base: string;
let browser: Browser | undefined;
beforeAll(async () => {
  app = await startApp("browser");
  base = app.base;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    await app.close();
    throw error;
  }
});
afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await app?.close();
  }
});
function check(name: string, fn: (page: Page) => Promise<unknown>, path = "/") {
  test(name, async () => {
    const page = await browser!.newPage();
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(20000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.goto(base + path);
      await fn(page);
      assert.deepEqual(errors, []);
    } catch (error) {
      await page.screenshot({ path: join(app.artifacts, name + ".png") }).catch(() => {});
      throw error;
    } finally {
      await page.close();
    }
  });
}
check("cold-click-batch-and-derived-total", async (p) => {
  await p.locator("#increment").click();
  await p.waitForFunction(() => document.querySelector("#counter")?.textContent === "1");
  assert.equal(await p.locator("#double").textContent(), "2");
  return { count: 1, double: 2 };
});
check("typed-produce-read-then-truncate", async (p) => {
  await p.locator("#produce-truncate").click();
  await p.waitForFunction(() => document.querySelector("#produce-length")?.textContent === "0");
  assert.equal(await p.locator("#produce-length").textContent(), "0");
  assert.equal(await p.locator("#produce-second").textContent(), "absent");
  return { length: 0 };
});
check("keyed-reorder-preserves-local-input-and-node", async (p) => {
  const input = p.locator('[data-row="1"] input');
  await input.fill("unsaved draft");
  await input.evaluate((e) => {
    Reflect.set(globalThis, "__keptNode", e);
  });
  await p.locator("#reverse").click();
  await p.waitForFunction(() => document.querySelector("#incidents tr")?.getAttribute("data-row") === "120");
  assert.equal(await p.locator('[data-row="1"] input').inputValue(), "unsaved draft");
  assert.ok(await p.locator('[data-row="1"] input').evaluate((e) => e === Reflect.get(globalThis, "__keptNode")));
  return { sameNode: true };
});
check("nested-conditional-keyed-children", async (p) => {
  await p.locator('[data-row="1"] .expand').click();
  await p.waitForFunction(() => document.querySelector('[data-note="1-1"]'));
  await p.locator("#reverse").click();
  await p.locator('[data-row="1"] .add-note').click();
  await p.waitForFunction(() => document.querySelectorAll('[data-row="1"] [data-note]').length === 3);
  return { notes: 3 };
});
check("filter-conditional-empty-restore", async (p) => {
  await p.locator("#filter").fill("does-not-exist");
  await p.waitForFunction(() => document.querySelectorAll("#incidents tr").length === 0);
  assert.equal(await p.locator("#empty").textContent(), "No incidents");
  await p.locator("#filter").fill("Incident 001");
  await p.waitForFunction(() => document.querySelectorAll("#incidents tr").length === 1);
  return { rows: 1 };
});
check("resource-race-latest-response-wins", async (p) => {
  await p.locator("#slow-search").click();
  await p.locator("#fast-search").click();
  await p.waitForFunction(() => document.querySelector("#search-result")?.textContent === "fast");
  await p.waitForTimeout(350);
  assert.equal(await p.locator("#search-result").textContent(), "fast");
  return { result: "fast" };
});
check("resource-error-recovers", async (p) => {
  await p.locator("#error-search").click();
  await p.waitForFunction(() => document.querySelector("#search-state")?.textContent === "errored");
  await p.locator("#fast-search").click();
  await p.waitForFunction(() => document.querySelector("#search-result")?.textContent === "fast");
  return { recovered: true };
});
check("sse-websocket-and-owner-cleanup", async (p) => {
  await p.locator("#connect").click();
  await p.waitForFunction(
    () => Number(document.querySelector("#sse-count")?.textContent) >= 3 && Number(document.querySelector("#ws-count")?.textContent) >= 3,
  );
  await p.locator("#connect").click();
  await expect
    .poll(
      async () => {
        const s = await (await fetch(base + "/api/stats")).json();
        return [s.sseActive, s.wsActive];
      },
      { timeout: 5000 },
    )
    .toEqual([0, 0]);
  const stats = await (await fetch(base + "/api/stats")).json();
  assert.equal(stats.sseActive, 0);
  assert.equal(stats.wsActive, 0);
  return stats;
});
check("controlled-select-textarea-model", async (p) => {
  await p.locator("#editor-text").fill("edited\nsecond line");
  await p.locator("#severity").selectOption("critical");
  await p.waitForFunction(() => document.querySelector("#editor-output")?.textContent === "critical:edited\nsecond line");
  return { models: true };
});
check(
  "rich-loader-data-survives-resume",
  async (p) => {
    await p.locator("#rich-click").click();
    await p.waitForFunction(() => document.querySelector("#rich-counter")?.textContent === "1");
    assert.equal(await p.locator("#rich-value").textContent(), "2026-01-02T00:00:00.000Z|42|7|true");
    return { rich: true };
  },
  "/rich",
);
check(
  "error-boundary-catches-binding-and-resets",
  async (p) => {
    await p.locator("#break-widget").click();
    await p.locator("#caught").waitFor();
    await p.locator("#recover-widget").click();
    await p.locator("#healthy").waitFor();
    assert.equal(await p.locator("#healthy").textContent(), "healthy");
    return { recovered: true };
  },
  "/errors",
);
