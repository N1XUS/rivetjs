// Tree drag and drop on a resumed page (story `/tree-dnd`): server markup carries drag buttons with valid instruction
// targets, `draggable` rows and no drop indicators, no library code before interaction, and the first input on the cold
// page drags: a keyboard drag from the drag button (Enter → Tab to a drop target → Enter) and a native mouse drag.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, libraryScripts, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

type Page = import("playwright").Page;
const rowNames = (page: Page) => page.$$eval("#tree-dnd .rv-TreeItem", (els) => els.map((el) => el.querySelector("span")?.textContent ?? ""));
const untilRows = (page: Page, names: string[]) =>
  page.waitForFunction(
    (names) =>
      JSON.stringify([...document.querySelectorAll("#tree-dnd .rv-TreeItem")].map((el) => el.querySelector("span")?.textContent ?? "")) ===
      JSON.stringify(names),
    names,
  );

test("Tree drag and drop SSR: drag affordances only, no library code before interaction", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/tree-dnd");
  assert.deepEqual(await rowNames(page), ["Documents", "Report", "Photos", "Music"]);
  assert.deepEqual(await page.$$eval("#tree-dnd .rv-TreeItem", (els) => els.map((el) => el.getAttribute("draggable"))), ["true", "true", "true", "true"]);
  assert.equal(await page.getAttribute('#tree-dnd [data-key="photos"] [slot="drag"]', "aria-label"), "Drag Photos");
  const descriptions = await page.$$eval('#tree-dnd [slot="drag"]', (buttons) =>
    buttons.map((button) => {
      const id = button.getAttribute("aria-describedby");
      const target = id && document.getElementById(id);
      return { id, text: target ? target.textContent : null, inCell: !!target && target.closest('[role="gridcell"]') === button.closest('[role="gridcell"]') };
    }),
  );
  assert.equal(new Set(descriptions.map(({ id }) => id)).size, 4);
  assert.ok(
    descriptions.every(({ id, text, inCell }) => id && text === "Click to start dragging." && inCell),
    "server drag instructions resolve within each row",
  );
  assert.equal(await page.$$eval("#tree-dnd .rv-DropIndicator", (els) => els.length), 0);
  await page.waitForLoadState("networkidle");
  assert.equal(await page.$('script[type="rivet/boundaries"][data-boot]'), null, "nothing boots by itself");
  assert.deepEqual(libraryScripts(seen), [], "no library code before interaction");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("Tree drag and drop: cold keyboard drag from the drag button reorders", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/tree-dnd");
  await page.waitForLoadState("networkidle");
  // Focus the Music row, move to its drag button, start a keyboard drag.
  await page.focus('#tree-dnd [data-key="music"]');
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Drag Music");
  await page.waitForFunction(() => document.querySelector("#tree-dnd-music-drag-description")?.textContent === "Press Enter to start dragging.");
  await page.keyboard.press("Enter");
  // The session focuses the drop target nearest to the dragged row; arrows walk the targets, Home goes to the first.
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Insert after Music");
  // Native Enter activation can report virtual modality (see dnd/CLAUDE.md); the row still exposes current cancel instructions.
  await page.waitForFunction(() =>
    /^Dragging\. (?:Press Enter|Double tap|Click) to cancel drag\.$/.test(document.querySelector("#tree-dnd-music-drag-description")?.textContent ?? ""),
  );
  await page.keyboard.press("ArrowUp");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Insert between Photos and Music");
  await page.keyboard.press("ArrowUp");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Drop on Photos");
  await page.keyboard.press("Home");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Insert before Documents");
  await page.keyboard.press("Enter");
  await untilRows(page, ["Music", "Documents", "Report", "Photos"]);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("Tree drag and drop: cold mouse drag of a row reorders", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/tree-dnd");
  await page.waitForLoadState("networkidle");
  const target = await page.$('#tree-dnd [data-key="documents"]');
  const box = (await target!.boundingBox())!;
  // Drop on the top quarter of Documents: "before Documents".
  await page.dragAndDrop('#tree-dnd [data-key="photos"] span', '#tree-dnd [data-key="documents"]', { targetPosition: { x: box.width / 2, y: 2 } });
  await untilRows(page, ["Photos", "Documents", "Report", "Music"]);
  assert.deepEqual(seen.errors, []);
  await page.close();
});
