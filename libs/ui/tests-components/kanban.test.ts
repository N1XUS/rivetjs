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

// KANBAN-SELECT (2026-10-29): `.CardList selectionMode` = cdk GridList semantics over the rendered cards. Server markup
// carries the grid / row roles, roving tabindex and the default selection; the first (cold) press selects.
test("kanban selection: server markup, cold click, keyboard selection", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(s.origin + "/kanban");
  await page.waitForLoadState("networkidle");
  const attrs = (sel: string, names: string[]) => page.$eval(sel, (el, names) => names.map((n) => el.getAttribute(n)), names);
  assert.deepEqual(await attrs("#kbs-todo", ["role", "aria-multiselectable", "tabindex"]), ["grid", "true", "0"]);
  assert.deepEqual(await attrs("#kbs-doing", ["role", "aria-multiselectable"]), ["grid", null]);
  assert.deepEqual(await attrs("#kbs-card-s1", ["role", "aria-selected", "tabindex", "data-selected"]), ["row", "false", "-1", null]);
  assert.deepEqual(await attrs("#kbs-card-s2", ["role", "aria-selected", "data-selected"]), ["row", "true", "true"]);
  assert.equal(await page.locator("#kbs-card-s1 > [role=gridcell]").count(), 1);
  // Cold click: toggles s1 into the selection (multiple, toggle behaviour).
  await page.click("#kbs-card-s1");
  await page.waitForFunction(() => document.querySelector("#kbs-selected")?.textContent === "s1 s2", undefined, { timeout: 5000 });
  assert.equal(await page.getAttribute("#kbs-card-s1", "aria-selected"), "true");
  assert.equal(await page.getAttribute("#kbs-card-s1", "tabindex"), "0");
  assert.equal(await page.getAttribute("#kbs-todo", "tabindex"), "-1");
  // Keyboard: ArrowDown moves focus, Space toggles, Escape clears.
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.activeElement?.id === "kbs-card-s2", undefined, { timeout: 5000 });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press(" ");
  await page.waitForFunction(() => document.querySelector("#kbs-selected")?.textContent === "s1 s2 s3", undefined, { timeout: 5000 });
  await page.keyboard.press(" ");
  await page.waitForFunction(() => document.querySelector("#kbs-selected")?.textContent === "s1 s2", undefined, { timeout: 5000 });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#kbs-selected")?.textContent === "", undefined, { timeout: 5000 });
  assert.equal(await page.locator("#kbs [data-selected]").count(), 0);
  // Single selection in Doing: a click selects, a second card replaces it.
  await page.click("#kbs-card-s4");
  await page.waitForFunction(() => document.querySelector("#kbs-card-s4")?.getAttribute("aria-selected") === "true", undefined, { timeout: 5000 });
  await page.click("#kbs-card-s5");
  await page.waitForFunction(() => document.querySelector("#kbs-card-s5")?.getAttribute("aria-selected") === "true", undefined, { timeout: 5000 });
  assert.equal(await page.getAttribute("#kbs-card-s4", "aria-selected"), "false");
  assert.deepEqual(errors, []);
  await page.close();
});

test("kanban selection: cold Tab focuses the selected card, Enter picks up (board keyboard moves), drag does not select", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1100, height: 900 } });
  await page.goto(s.origin + "/kanban");
  await page.waitForLoadState("networkidle");
  assert.equal((await page.getAttribute("#kbs-card-s1", "aria-describedby")) !== null, true);
  await page.focus("#kbs-todo");
  await page.waitForFunction(() => document.activeElement?.id === "kbs-card-s2", undefined, { timeout: 5000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#kbs-card-s2[data-grabbed]", { timeout: 5000 });
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector("#kbs-order")?.textContent?.includes("s2:doing"), undefined, { timeout: 5000 });
  await page.waitForFunction(() => document.activeElement?.id === "kbs-card-s2", undefined, { timeout: 5000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector("#kbs [data-grabbed]"), undefined, { timeout: 5000 });
  // The moved card is not selected in its new (single selection) list; To do keeps a tab stop.
  assert.equal(await page.getAttribute("#kbs-card-s2", "aria-selected"), "false");
  assert.equal(await page.getAttribute("#kbs-todo", "tabindex"), "0");
  // A mouse drag from To do into Doing moves the card without selecting it.
  await drag(page, "#kbs-card-s3", "#kbs-doing");
  await page.waitForFunction(() => document.querySelector("#kbs-order")?.textContent?.includes("s3:doing"), undefined, { timeout: 5000 });
  assert.equal(await page.textContent("#kbs-selected"), "s2");
  assert.equal(await page.getAttribute("#kbs-card-s3", "aria-selected"), "false");
  await page.close();
});
