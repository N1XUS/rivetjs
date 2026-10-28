// Resumed pages that start nothing by themselves (CEFF 2026-10-28): client effects that only matter after the first
// event carry `when: "interaction"` (or a conditional / `visible` trigger), so these stories set no `data-boot` and load
// no library code before input; the first interaction still runs what those effects did.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, libraryScripts, type Stories, type Watch } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

/** After the page settled: no load / idle / visible trigger, no library chunk fetched. */
async function quiet(page: import("playwright").Page, seen: Watch, route: string): Promise<void> {
  await page.waitForLoadState("networkidle");
  assert.equal(await page.$('script[type="rivet/boundaries"][data-boot]'), null, `${route}: nothing boots by itself`);
  // Length, not deepEqual: a failing diff of a long script list blows up node:assert's diff memory.
  const scripts = libraryScripts(seen);
  assert.equal(scripts.length, 0, `${route}: no library code before interaction: ${scripts.slice(0, 5).join(", ")}`);
}

for (const route of ["/slots", "/forms", "/date-picker", "/list-data", "/lazy-rows", "/virtualized-collections", "/selection-indicator-groups"])
  test(`no idle boot: ${route}`, async () => {
    const page = await s.browser.newPage();
    const seen = watch(page);
    await page.goto(s.origin + route);
    await quiet(page, seen, route);
    assert.deepEqual(seen.errors, []);
    await page.close();
  });

test("no idle boot: text field with a server error (slot cleanup waits for the part's unit); edit clears the error id", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/text-field");
  await quiet(page, seen, "/text-field");
  const errorId = await page.$eval("#tf-user-error", (el) => el.id);
  assert.match((await page.getAttribute("#tf-user", "aria-describedby")) ?? "", new RegExp(`\\b${errorId}\\b`));
  await page.focus("#tf-user");
  await page.keyboard.press("End");
  await page.keyboard.type("x");
  await page.keyboard.press("Tab");
  await page.waitForFunction(() => document.querySelector("#tf-user")?.getAttribute("aria-invalid") === null);
  assert.equal(await page.isHidden("#tf-user-error"), true);
  assert.doesNotMatch((await page.getAttribute("#tf-user", "aria-describedby")) ?? "", new RegExp(`\\b${errorId}\\b`));
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("no idle boot: tag group; removing the focused tag still moves focus to a neighbour", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/tag-group");
  await quiet(page, seen, "/tag-group");
  await page.focus("#tg-remove [data-key=travel]");
  await page.keyboard.press("Delete");
  await page.waitForFunction(() => document.querySelectorAll("#tg-remove [role=row]").length === 2);
  // useTagGroup: focus moves to the next tag (the effect that was idle-triggered before).
  await page.waitForFunction(() => document.activeElement?.closest("#tg-remove [role=row]")?.getAttribute("data-key") === "gaming");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
