// FileTree on a resumed page (`/file-tree`; Rivet addition, feature set inspired by HeroUI Pro's public File Tree docs): a
// cold chevron press expands a folder (child row appears, data-expanded), keyboard Left collapses it, row presses select
// (multiple selection count), guide-line indent widens per level.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("file tree: cold expand, keyboard collapse, selection, indent", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 900 } });
  await page.goto(s.origin + "/file-tree");
  await page.waitForLoadState("networkidle");
  const rows = () => page.evaluate(() => [...document.querySelectorAll("#ft [role=row]")].map((e) => e.getAttribute("data-key")));
  assert.deepEqual(await rows(), ["src", "components", "index", "readme"]);
  await page.click('#ft [role=row][data-key="components"] [slot=chevron]');
  await page.waitForFunction(() => document.querySelector('#ft [role=row][data-key="button"]') !== null);
  assert.equal(await page.locator('#ft [role=row][data-key="components"]').getAttribute("data-expanded"), "true");
  const indent = (key: string) =>
    page.evaluate((k) => (document.querySelector(`#ft [role=row][data-key="${k}"] [data-slot=file-tree-indent]`) as HTMLElement).offsetWidth, key);
  assert.ok((await indent("button")) > (await indent("components")));
  assert.equal(await indent("src"), 0);
  await page.focus('#ft [role=row][data-key="components"]');
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => document.querySelector('#ft [role=row][data-key="button"]') === null);
  await page.click('#ft [role=row][data-key="readme"]');
  await page.click('#ft [role=row][data-key="index"]');
  await page.waitForFunction(() => document.querySelector("#ft-count")?.textContent === "2 selected");
  await page.close();
});
