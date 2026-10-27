// Kanban on a resumed page (`/kanban`; UI-PORT S6, Rivet addition with a feature set inspired by HeroUI Pro's public Kanban
// docs): no drag-drop script before input; a cold mouse drag moves a card into the empty Done column (board order, counts,
// the empty state hides), a second drag reorders within To do.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

// One `mouse.move` around the drag start is sometimes never acknowledged on this page (the page itself keeps handling input
// and the drag completes; the hang is in Playwright's input round trip), so each move is bounded.
const move = (page: import("playwright").Page, x: number, y: number) => Promise.race([page.mouse.move(x, y), page.waitForTimeout(250)]);

async function drag(page: import("playwright").Page, from: string, to: string, dy = 0) {
  const a = (await page.locator(from).boundingBox())!;
  const b = (await page.locator(to).boundingBox())!;
  const [x0, y0] = [a.x + a.width / 2, a.y + a.height / 2];
  const [x1, y1] = [b.x + b.width / 2, b.y + b.height / 2 + dy];
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  // The cold press loads the drag engine: keep moving past the threshold until the drag has started.
  let i = 1;
  for (; i <= 50 && !(await page.$(".cdk-drag-preview")); i++) {
    await move(page, x0 + i, y0 + i);
    await page.waitForTimeout(100);
  }
  assert.ok(await page.$(".cdk-drag-preview"), "drag started");
  for (let k = 1; k <= 12; k++) await move(page, x0 + i + ((x1 - x0 - i) * k) / 12, y0 + i + ((y1 - y0 - i) * k) / 12);
  await page.mouse.up();
  await page.waitForSelector(".cdk-drag-preview", { state: "detached", timeout: 5000 });
}

test("kanban: cold drag across columns and within a column", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1100, height: 800 } });
  await page.goto(s.origin + "/kanban");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator("#kb-done .kanban__empty").isVisible(), true);
  assert.equal(await page.locator("#kb-todo .kanban__empty").isVisible(), false);
  await drag(page, "#kb-card-t1", "#kb-done");
  await page.waitForFunction(() => document.querySelector("#kb-order")?.textContent?.includes("t1:done"), undefined, { timeout: 5000 });
  assert.equal(await page.textContent("#kb-done-count"), "1");
  assert.equal(await page.textContent("#kb-todo-count"), "1");
  await page.waitForFunction(() => getComputedStyle(document.querySelector("#kb-done .kanban__empty")!).display === "none", undefined, { timeout: 5000 });
  assert.equal(await page.locator("#kb-done #kb-card-t1").count(), 1);
  // move t3 (doing) above t2 in To do
  await drag(page, "#kb-card-t3", "#kb-card-t2", -10);
  await page.waitForFunction(() => document.querySelector("#kb-order")?.textContent === "t3:todo t2:todo t1:done", undefined, { timeout: 5000 });
  assert.equal(await page.locator("#kb-doing .kanban__empty").isVisible(), true);
  await page.close();
});
