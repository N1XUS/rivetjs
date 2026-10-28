// Resumed pages that start nothing by themselves (CEFF 2026-10-28): ui / cdk client effects that only matter after the
// first event carry `when: "interaction"` (or a conditional / `visible` trigger) — InputOTP, src-less Avatars, Table,
// TagGroup, invalid fields. These stories set no `data-boot` and load no library code before input; the first interaction
// still runs what those effects did. Tabs lists still boot (ScrollShadow's `data-*-scroll` attributes show the chevrons).
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

for (const route of ["/avatar-group", "/button-group", "/collections", "/icons", "/pickers", "/table", "/table-tanstack", "/wave1"])
  test(`no idle boot: ${route}`, async () => {
    const page = await s.browser.newPage();
    const seen = watch(page);
    await page.goto(s.origin + route);
    await quiet(page, seen, route);
    assert.deepEqual(seen.errors, []);
    await page.close();
  });

test("no idle boot: InputOTP; the first click mirrors the selection (active slot + caret), typing fills the slots", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/forms");
  await quiet(page, seen, "/forms");
  await page.click("[data-testid=otp]");
  await page.waitForFunction(() => document.querySelector("#otp-0")?.getAttribute("data-active") === "true");
  assert.ok(await page.$("#otp-0 [data-slot=input-otp-caret]"), "fake caret in the empty active slot");
  await page.keyboard.type("12");
  await page.waitForFunction(() => document.querySelector("#otp-state")?.textContent === "12");
  assert.equal(await page.textContent("#otp-1 [data-slot=input-otp-slot-value]"), "2");
  await page.waitForFunction(() => document.querySelector("#otp-2")?.getAttribute("data-active") === "true");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
