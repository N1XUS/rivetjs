// `render` prop (inline arrows) on every handler-bearing part, SSR + resume (story `/render-resumed`): the rendered element resumes, one
// interaction works and focus stays on the element (I1: a `tabIndex` key in the spread attrs dropped `tabindex` and blurred it; rows and
// picker content kept across the rendered root's first spread re-run: runtime ` #r` child site).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories, type Watch } from "./harness.ts";

let s: Stories;
let page: Page;
let seen: Watch;
beforeAll(async () => {
  s = await stories();
  page = await s.browser.newPage();
  seen = watch(page);
  await page.goto((process.env.RV_ORIGIN ?? s.origin) + "/render-resumed");
});
afterAll(async () => s?.close());

const waitText = (selector: string, expected: string) =>
  page.waitForFunction(([sel, want]) => document.querySelector(sel!)!.textContent === want, [selector, expected] as const);
const activeId = () => page.evaluate(() => document.activeElement?.id ?? "");
const activeKey = () => page.evaluate(() => document.activeElement?.getAttribute("data-key") ?? "");
/** Cold element after a click: its `tabindex` and focus are still there once the click's bindings flushed. */
const settle = () => page.waitForTimeout(150);

test("rendered elements are in the server markup with the right tags", async () => {
  const tags = await page.evaluate(() =>
    Object.fromEntries([
      ...["rr-group", "rr-form", "rr-tbg", "rr-toolbar", "rr-gl", "rr-lb", "rr-tree", "rr-cal"].map((id) => [id, document.getElementById(id)?.tagName]),
      ...["gl1", "t1", "lb1", "tr1"].map((key) => [key, document.querySelector(`[data-key="${key}"]`)?.tagName]),
      ["picker", document.querySelector("[data-rv-date-picker]")?.tagName],
    ]),
  );
  assert.deepEqual(tags, {
    "rr-group": "SECTION",
    "rr-form": "FORM",
    "rr-tbg": "SECTION",
    "rr-toolbar": "SECTION",
    "rr-gl": "SECTION",
    gl1: "ARTICLE",
    t1: "SPAN",
    "rr-lb": "SECTION",
    lb1: "ARTICLE",
    "rr-tree": "SECTION",
    tr1: "ARTICLE",
    "rr-cal": "SECTION",
    picker: "SECTION",
  });
});

test("Group: focus-within resumes", async () => {
  await page.click("#rr-group-input");
  await page.waitForFunction(() => document.getElementById("rr-group")!.hasAttribute("data-focus-within"));
  assert.equal(await activeId(), "rr-group-input");
});

test("Form: submit handler runs", async () => {
  await page.click("#rr-form-submit");
  await page.waitForFunction(() => document.getElementById("rr-log")!.textContent!.includes("submit"));
});

test("ToggleButtonGroup: click selects", async () => {
  await page.click('#rr-tbg button:has-text("B")');
  await waitText("#rr-tbg-out", "rr-tbg-b");
});

test("Toolbar: ArrowRight moves focus", async () => {
  await page.focus("#rr-tool-1");
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.activeElement?.id === "rr-tool-2");
});

test("Menu / MenuItem: opens, arrow + Enter run the action, focus on the item", async () => {
  await page.click("#rr-menu-trigger");
  await page.waitForSelector("#rr-menu");
  assert.equal(await page.evaluate(() => document.getElementById("rr-menu")!.tagName), "SECTION");
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-key") === "rr-copy");
  await settle();
  assert.equal(await activeKey(), "rr-copy");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.getElementById("rr-log")!.textContent!.includes("action:rr-copy"));
  await page.waitForFunction(() => !document.getElementById("rr-menu"));
});

// Rows of a rendered GridList / ListBox / Tree keep their element (and focus) across the first selection change: the rendered
// root's spread `children` function is its own resumed site (` #r`), so the root's attribute re-run does not re-render the rows
// (runtime `_rSpread` / `_spread`; was: every row replaced, focus dropped to <body>).
for (const [name, key, out] of [
  ["GridList", "gl1", "rr-gl-out"],
  ["Tag", "t2", "rr-tg-out"],
  ["ListBox", "lb2", "rr-lb-out"],
  ["Tree", "tr1", "rr-tr-out"],
] as const) {
  const item = `[data-key="${key}"]`;
  test(`${name}: click selects`, async () => {
    await page.click(item);
    await waitText("#" + out, key);
    await settle();
    assert.equal(await page.getAttribute(item, "aria-selected"), "true");
    assert.notEqual(await page.getAttribute(item, "tabindex"), null);
  });
  test(`${name}: focus stays on the rendered element`, async () => assert.equal(await activeKey(), key));
  if (key === "gl1")
    // RA useGridListItem + useSlotId: the row keeps `aria-labelledby="<row id> <description id>"` while its description renders.
    test("GridList: row aria-labelledby survives the selection change", async () => {
      const lb = () => page.getAttribute(item, "aria-labelledby");
      const value = await lb();
      assert.match(value ?? "", /^rr-gl-gl1 \S+$/);
      assert.equal(await page.evaluate((id) => !!document.getElementById(id), value!.split(" ")[1]), true);
    });
}

test("Popover trigger: opens the rendered popover", async () => {
  await page.click("#rr-pop-trigger");
  await page.waitForSelector("[data-rv-overlay]");
  assert.equal(await page.evaluate(() => document.querySelector("[data-rv-overlay]")!.tagName), "SECTION");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("[data-rv-overlay]"));
});

test("Calendar / CalendarCell: cell click selects", async () => {
  await page.click("#rr-cal [data-date='2026-10-20']");
  await waitText("#rr-cal-out", "2026-10-20");
});

// Production build: the cell keeps focus (the Vite dev server re-creates it, a dev-only difference).
test("Calendar / CalendarCell: focus stays on the cell", async () => {
  await settle();
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-date")), "2026-10-20");
});

test("DateSegment: focus sets data-focused, ArrowUp changes the value", async () => {
  const seg = "#rr-df [role=spinbutton]";
  await page.focus(seg);
  await page.waitForFunction((sel) => document.querySelector(sel)!.hasAttribute("data-focused"), seg);
  const before = await page.getAttribute(seg, "aria-valuenow");
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction(([sel, was]) => document.querySelector(sel!)!.getAttribute("aria-valuenow") !== was, [seg, before] as const);
  assert.ok(await page.evaluate((sel) => document.activeElement === document.querySelector(sel), seg));
});

// The rendered picker root keeps its server group / segments on open (same ` #r` site; was: content replaced, "Missing resumable element").
test("DatePicker: button opens the calendar popover, Escape closes it", async () => {
  await page.click("[data-rv-date-picker] button");
  await page.waitForSelector("[role=dialog] [role=grid]");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("[role=dialog] [role=grid]"));
});

test("no page errors", () => {
  assert.deepEqual(seen.errors, []);
});
