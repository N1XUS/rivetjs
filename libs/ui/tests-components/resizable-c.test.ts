// Resizable handle types / variants / indicator on a resumed page (`/resizable-c`; UI-PORT-C, names from HeroUI Pro's
// public Resizable docs, independent implementation): nothing boots at load; a `line` is 1px of the separator token, `drag`
// shows the grip chip, `pill` a 6 x 32 pill on the line, `handle` the pill alone (transparent line); `tertiary` uses its
// token; the pill follows the accent on hover; a composed pill in a vertical group lies across; the CSS variables resize
// line and pill; keys still resize after the cold boot.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("resizable c: handle types, variants, indicator, CSS variables", async () => {
  const page = await s.browser.newPage({ viewport: { width: 800, height: 1100 } });
  const seen = watch(page);
  await page.goto(s.origin + "/resizable-c");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.evaluate(() => document.querySelector("[data-boot]") === null), true);
  const style = (sel: string, prop: string) =>
    page.evaluate(([sel, prop]) => getComputedStyle(document.querySelector(sel!)!).getPropertyValue(prop!), [sel, prop]);
  const box = async (sel: string) => (await page.locator(sel).boundingBox())!;
  const transparent = "rgba(0, 0, 0, 0)";

  assert.equal((await box("#rz-line-h")).width, 1);
  const line = await style("#rz-line-h", "background-color");
  assert.notEqual(line, transparent);
  assert.equal(await page.locator("#rz-line-h > *").count(), 0);
  assert.equal(await page.locator("#rz-drag-h [data-slot=resizable-handle-grip] svg").count(), 1);
  const pill = await box("#rz-pill-h [data-slot=resizable-indicator]");
  assert.deepEqual([pill.width, pill.height], [6, 32]);
  assert.equal(await style("#rz-handle-h", "background-color"), transparent);
  const standalone = await style("#rz-handle-h [data-slot=resizable-indicator]", "background-color");
  assert.notEqual(standalone, transparent);
  assert.notEqual(await style("#rz-tertiary-h", "background-color"), line);
  assert.equal(await page.locator("#rz-tertiary-h [data-slot=resizable-indicator][data-type=drag] svg").count(), 1);

  // hover: the pill takes the hover colour (the line state)
  const rest = await style("#rz-pill-h [data-slot=resizable-indicator]", "background-color");
  // trusted CDP moves (the first boots the cold group on `pointerover`, the next ones hit-test the separator)
  const at = await box("#rz-pill-h");
  const cdp = await page.context().newCDPSession(page);
  const move = (dy: number) => cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x + at.width / 2, y: at.y + dy, button: "none", buttons: 0 });
  await move(10);
  await page.waitForFunction(() => document.querySelector("#rz-pill-h")!.hasAttribute("aria-valuenow"));
  await move(12);
  await move(14);
  await page.waitForFunction(() => document.querySelector("#rz-pill-h")!.getAttribute("data-separator") === "hover");
  await page.waitForFunction((rest) => getComputedStyle(document.querySelector("#rz-pill-h [data-slot=resizable-indicator]")!).backgroundColor !== rest, rest);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 5, button: "none", buttons: 0 });
  await cdp.detach();

  // vertical group: the line is horizontal, the composed pill lies across (32 x 6)
  assert.equal((await box("#rz-vertical-h")).height, 1);
  const across = await box("#rz-vertical-h [data-slot=resizable-indicator]");
  assert.deepEqual([across.width, across.height], [32, 6]);

  // variables on the group
  assert.equal((await box("#rz-vars-h")).width, 4);
  assert.equal((await box("#rz-vars-h [data-slot=resizable-indicator]")).height, 48);

  // cold keyboard resize on a pill handle
  await page.focus("#rz-pill-h");
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector("#rz-pill-h")!.getAttribute("aria-valuenow") === "55");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
