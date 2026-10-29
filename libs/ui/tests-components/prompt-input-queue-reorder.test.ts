// PromptInput queue reordering on a resumed page (`/prompt-input-queue-reorder`; PRO-LAST): server drag markup; a cold
// mouse drag moves the first row below the last (stored order + DOM order), a warm drag moves it back up; cold
// Alt+ArrowUp / Alt+ArrowDown move the focused row and keep focus (the row is blurred around the move: a resumed keyed
// `For` moving the focused row rendered one row twice, runtime gap); `axis="x"` drags horizontally, Alt+ArrowLeft / Right.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

// Bounded moves: one `mouse.move` around a lazily started drag can hang in Playwright's input round trip (kanban.test.ts).
const move = (page: import("playwright").Page, x: number, y: number) => Promise.race([page.mouse.move(x, y), page.waitForTimeout(250)]);

async function drag(page: import("playwright").Page, from: string, to: string, offset: [number, number] = [0, 0]) {
  const a = (await page.locator(from).boundingBox())!;
  const b = (await page.locator(to).boundingBox())!;
  const [x0, y0] = [a.x + a.width / 2, a.y + a.height / 2];
  const [x1, y1] = [b.x + b.width / 2 + offset[0], b.y + b.height / 2 + offset[1]];
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

const rows = (page: import("playwright").Page, list: string) => page.$$eval(`${list} > [data-slot=prompt-input-queue-item]`, (els) => els.map((el) => el.id));

test("queue reorder: server markup, cold mouse drag, warm drag back", async () => {
  const page = await s.browser.newPage({ viewport: { width: 900, height: 700 } });
  const seen = watch(page);
  await page.goto(s.origin + "/prompt-input-queue-reorder");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.getAttribute("#queue", "data-reorderable"), "true");
  assert.equal(await page.getAttribute("#q-1", "tabindex"), "0");
  assert.deepEqual(await rows(page, "#queue"), ["q-1", "q-2", "q-3"]);
  await drag(page, "#q-1", "#q-3", [0, 8]);
  await page.waitForFunction(() => document.querySelector("#queue-order")?.textContent === "2,3,1", undefined, { timeout: 5000 });
  assert.deepEqual(await rows(page, "#queue"), ["q-2", "q-3", "q-1"]);
  await drag(page, "#q-1", "#q-2", [0, -8]);
  await page.waitForFunction(() => document.querySelector("#queue-order")?.textContent === "1,2,3", undefined, { timeout: 5000 });
  assert.deepEqual(await rows(page, "#queue"), ["q-1", "q-2", "q-3"]);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("queue reorder: cold Alt+Arrow keys move the focused row, focus stays; axis x", async () => {
  const page = await s.browser.newPage({ viewport: { width: 900, height: 700 } });
  const seen = watch(page);
  await page.goto(s.origin + "/prompt-input-queue-reorder");
  await page.waitForLoadState("networkidle");
  await page.focus("#q-1");
  await page.keyboard.press("Alt+ArrowDown");
  await page.waitForFunction(() => document.querySelector("#queue-order")?.textContent === "2,1,3", undefined, { timeout: 5000 });
  await page.waitForFunction(() => document.activeElement?.id === "q-1", undefined, { timeout: 5000 });
  await page.keyboard.press("Alt+ArrowDown");
  await page.waitForFunction(() => document.querySelector("#queue-order")?.textContent === "2,3,1", undefined, { timeout: 5000 });
  // Past the end: nothing moves.
  await page.keyboard.press("Alt+ArrowDown");
  await page.keyboard.press("Alt+ArrowUp");
  await page.waitForFunction(() => document.querySelector("#queue-order")?.textContent === "2,1,3", undefined, { timeout: 5000 });
  assert.deepEqual(await rows(page, "#queue"), ["q-2", "q-1", "q-3"]);
  // Horizontal list: Alt+ArrowRight, then a mouse drag along x.
  assert.equal(await page.getAttribute("#queue-x", "data-orientation"), "horizontal");
  await page.focus("#x-alpha");
  await page.keyboard.press("Alt+ArrowDown");
  await page.keyboard.press("Alt+ArrowRight");
  await page.waitForFunction(() => document.querySelector("#queue-x-order")?.textContent === "beta,alpha,gamma", undefined, { timeout: 5000 });
  await drag(page, "#x-gamma", "#x-beta", [-20, 0]);
  await page.waitForFunction(() => document.querySelector("#queue-x-order")?.textContent === "gamma,beta,alpha", undefined, { timeout: 5000 });
  assert.deepEqual(seen.errors, []);
  await page.close();
});
