import { beforeAll, afterAll, test, expect } from "vitest";
import assert from "node:assert/strict";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { startApp, type AppFixture } from "./_support.ts";
let app: AppFixture;
let base: string;
let browser: Browser | undefined;
beforeAll(async () => {
  app = await startApp("stress");
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
check("2000-rows-50-reorders-and-unsaved-local-state", async (p) => {
  await p.goto(base + "/?count=2000");
  assert.equal(await p.locator("#incidents tr").count(), 2000);
  const ids = [1, 73, 450, 1989];
  for (const id of ids) await p.locator(`[data-row="${id}"] input`).fill(`draft-${id}`);
  await p.locator('[data-row="1"] input').evaluate((e) => Reflect.set(globalThis, "__keptNode", e));
  for (let i = 0; i < 50; i++) {
    await p.locator("#reverse").click();
    const first = i % 2 === 0 ? "2000" : "1";
    await p.waitForFunction((id) => document.querySelector("#incidents tr")?.getAttribute("data-row") === id, first);
  }
  for (const id of ids) assert.equal(await p.locator(`[data-row="${id}"] input`).inputValue(), `draft-${id}`);
  assert.ok(await p.locator('[data-row="1"] input').evaluate((e) => e === Reflect.get(globalThis, "__keptNode")));
  return { rows: 2000, reorders: 50, drafts: ids.length, nodeIdentity: true };
});
check("20-transport-mount-unmount-cycles", async (p) => {
  await p.goto(base);
  const before = await (await fetch(base + "/api/stats")).json();
  for (let i = 0; i < 20; i++) {
    await p.locator("#connect").click();
    await p.waitForFunction(
      () => Number(document.querySelector("#sse-count")?.textContent) >= 2 && Number(document.querySelector("#ws-count")?.textContent) >= 2,
    );
    await p.locator("#connect").click();
    await p.locator("#sse-count").waitFor({ state: "detached" });
  }
  await expect
    .poll(
      async () => {
        const s = await (await fetch(base + "/api/stats")).json();
        return [s.sseActive, s.wsActive];
      },
      { timeout: 5000 },
    )
    .toEqual([0, 0]);
  const after = await (await fetch(base + "/api/stats")).json();
  assert.equal(after.sseActive, 0);
  assert.equal(after.wsActive, 0);
  assert.equal(after.sseStarted - before.sseStarted, 20);
  assert.equal(after.wsStarted - before.wsStarted, 20);
  return { cycles: 20, before, after };
});
check("cold-input-with-delayed-javascript-chunks", async (p) => {
  await p.route("**/assets/*.js", async (route) => {
    await new Promise((r) => setTimeout(r, 200));
    await route.continue();
  });
  await p.goto(base, { waitUntil: "domcontentloaded" });
  await p.locator("#editor-text").fill("typed before code arrived");
  await p.locator("#severity").selectOption("critical");
  await p.waitForFunction(() => document.querySelector("#editor-output")?.textContent === "critical:typed before code arrived");
  return { keptUserInput: true, chunkDelayMs: 200 };
});
check("20-resource-supersession-rounds", async (p) => {
  await p.goto(base);
  for (let i = 0; i < 20; i++) {
    const completed = p.waitForResponse((r) => new URL(r.url()).pathname === "/api/search" && new URL(r.url()).searchParams.get("q") === "fast");
    await p.locator("#slow-search").click();
    await p.locator("#fast-search").click();
    const response = await completed;
    assert.equal(response.status(), 200);
    await response.finished();
    await p.waitForFunction(() => document.querySelector("#search-state")?.textContent === "ready");
    await p.waitForFunction(() => document.querySelector("#search-result")?.textContent === "fast");
  }
  await p.waitForTimeout(350);
  assert.equal(await p.locator("#search-result").textContent(), "fast");
  return { rounds: 20, last: "fast" };
});
