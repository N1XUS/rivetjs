// Disclosure on a resumed page (story `/disclosure`, animated panel height): the first expand animates the size variables to
// the content (px, then `auto`) and the first collapse back to 0 + `hidden="until-found"`. Regression: the resumed panel
// element re-applied its server `style` (the initial size variables) after the hidden binding had set them, so the panel
// stayed at its server size on the first change.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const settled = (page: Page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
const panel = (page: Page, id: string) =>
  page.$eval(id, (el) => ({
    height: el.getBoundingClientRect().height,
    var: (el as HTMLElement).style.getPropertyValue("--disclosure-panel-height"),
    hidden: el.getAttribute("hidden"),
  }));

test("disclosure: first expand on a resumed page animates the panel to its content", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/disclosure");
  await page.waitForLoadState("networkidle");
  assert.deepEqual(await panel(page, "#d-panel"), { height: 0, var: "0px", hidden: "until-found" });
  await page.click("#d-trigger");
  await page.waitForFunction(() => document.querySelector("#d-trigger")?.getAttribute("aria-expanded") === "true");
  await settled(page);
  assert.deepEqual(await panel(page, "#d-panel"), { height: 40, var: "auto", hidden: null });
  await page.click("#d-trigger");
  await page.waitForFunction(() => document.querySelector("#d-panel")?.getAttribute("hidden") === "until-found");
  assert.equal((await panel(page, "#d-panel")).var, "0px");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("disclosure: first collapse of a defaultExpanded panel on a resumed page", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/disclosure");
  await page.waitForLoadState("networkidle");
  assert.equal((await panel(page, "#do-panel")).height, 40);
  await page.click("#do-trigger");
  await page.waitForFunction(() => document.querySelector("#do-panel")?.getAttribute("hidden") === "until-found");
  assert.deepEqual(await panel(page, "#do-panel"), { height: 0, var: "0px", hidden: "until-found" });
  await page.close();
});
