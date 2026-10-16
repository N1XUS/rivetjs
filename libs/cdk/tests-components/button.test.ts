// Button / ToggleButton — ported from react-aria-components test/Button.test.js, test/ToggleButton.test.js
// and react-aria test/button/useButton.test.js (Apache-2.0, © Adobe), against the resumed story app.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const waitText = (page: Page, selector: string, value: string) =>
  page.waitForFunction(([selector, value]) => document.querySelector(selector!)?.textContent?.replace(/\s+/g, " ").trim() === value, [
    selector,
    value,
  ] as const);
const waitAttr = (page: Page, selector: string, name: string, value: string | null) =>
  page.waitForFunction(([selector, name, value]) => (document.querySelector(selector!)?.getAttribute(name!) ?? null) === value, [
    selector,
    name,
    value,
  ] as const);

test("button: default class, DOM / form / accessibility props, no aria-disabled by default", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/button");
  assert.equal(await page.getAttribute("#b-press", "class"), "rv-Button");
  assert.equal(await page.getAttribute("#b-press", "type"), "button");
  assert.equal(await page.getAttribute("#b-press", "aria-disabled"), null);
  assert.equal(await page.getAttribute("#b-aria", "aria-label"), "Close");
  assert.equal(await page.getAttribute("#b-aria", "aria-expanded"), "false");
  assert.equal(await page.getAttribute("#b-aria", "aria-haspopup"), "dialog");
  assert.equal(await page.getAttribute("#b-aria", "aria-controls"), "b-log");
  assert.equal(await page.getAttribute("#b-aria", "tabindex"), "-1");
  assert.equal(await page.getAttribute("#b-submit", "type"), "submit");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("button: press state (data-pressed while the pointer is down), onPress + onClick once", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/button");
  const box = (await page.locator("#b-press").boundingBox())!;
  await page.mouse.move(box.x + 5, box.y + 5);
  await page.mouse.down();
  await waitAttr(page, "#b-press", "data-pressed", "true");
  await page.mouse.up();
  await waitText(page, "#b-log", "start:mouse change:true end:mouse change:false press:mouse click");
  assert.equal(await page.getAttribute("#b-press", "data-pressed"), null);
  await page.close();
});

test("button: pointer released outside cancels the press (no onPress)", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/button");
  const box = (await page.locator("#b-press").boundingBox())!;
  await page.mouse.move(box.x + 5, box.y + 5);
  await page.mouse.down();
  await waitAttr(page, "#b-press", "data-pressed", "true");
  await page.mouse.move(box.x + 5, box.y + 300);
  await page.mouse.up();
  await waitText(page, "#b-log", "start:mouse change:true end:mouse change:false");
  assert.equal(await page.getAttribute("#b-press", "data-pressed"), null);
  await page.close();
});

test("button: keyboard Enter / Space and virtual clicks", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/button");
  await page.focus("#b-press");
  await page.keyboard.press("Enter");
  await waitText(page, "#b-log", "start:keyboard change:true end:keyboard change:false press:keyboard click");
  await page.keyboard.down(" ");
  await waitAttr(page, "#b-press", "data-pressed", "true");
  await page.keyboard.up(" ");
  await waitText(
    page,
    "#b-log",
    "start:keyboard change:true end:keyboard change:false press:keyboard click start:keyboard change:true end:keyboard change:false press:keyboard click",
  );
  await page.evaluate(() => (document.getElementById("b-press") as HTMLButtonElement).click());
  await page.waitForFunction(() =>
    document.getElementById("b-log")!.textContent!.endsWith("press:keyboard click start:virtual change:true end:virtual change:false press:virtual click"),
  );
  await page.close();
});

test("button: disabled state", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/button");
  assert.equal(await page.isDisabled("#b-disabled"), true);
  assert.equal(await page.getAttribute("#b-disabled", "data-disabled"), "true");
  await page.click("#b-disabled", { force: true });
  await page.waitForTimeout(100);
  assert.equal((await page.textContent("#b-log"))?.trim(), "");
  await page.close();
});

test("button: isPending prevents explicit (mouse, keyboard) and implicit form submission", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/button");
  assert.equal(await page.getAttribute("#b-submit", "aria-disabled"), null);
  await page.click("#b-submit");
  await waitText(page, "#b-submits", "1");
  await waitAttr(page, "#b-submit", "aria-disabled", "true");
  assert.equal(await page.getAttribute("#b-submit", "data-pending"), "true");
  assert.equal(await page.getAttribute("#b-submit", "type"), "button");
  // No aria-label / aria-labelledby: the content names the button (RAC adds the progress id only to an explicit label).
  assert.equal(await page.getAttribute("#b-submit", "aria-labelledby"), null);
  assert.equal(await page.isVisible("#b-submit-progress"), true);
  // Playwright treats aria-disabled as not actionable: force the click.
  await page.click("#b-submit", { force: true });
  await page.focus("#b-submit");
  await page.keyboard.press("Enter");
  await page.focus("#b-in1");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  assert.equal(await page.textContent("#b-submits"), "1");
  // Focus stays available while pending.
  await page.focus("#b-submit");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "b-submit");
  await page.close();
});

test("toggle button: default class, aria-pressed / data-selected, onChange, keyboard, disabled", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/button");
  assert.equal(await page.getAttribute("#tb-pin", "class"), "rv-ToggleButton");
  assert.equal(await page.getAttribute("#tb-pin", "aria-pressed"), "false");
  assert.equal(await page.getAttribute("#tb-pin", "data-selected"), null);
  await page.click("#tb-pin");
  await waitAttr(page, "#tb-pin", "aria-pressed", "true");
  assert.equal(await page.getAttribute("#tb-pin", "data-selected"), "true");
  await waitText(page, "#tb-value", "on 1");
  await page.keyboard.press("Space");
  await waitText(page, "#tb-value", "off 10");
  await page.keyboard.press("Enter");
  await waitText(page, "#tb-value", "on 101");
  assert.equal(await page.isDisabled("#tb-disabled"), true);
  assert.equal(await page.getAttribute("#tb-disabled", "aria-pressed"), "true");
  assert.equal(await page.getAttribute("#tb-disabled", "data-disabled"), "true");
  await page.close();
});

test("button: global DOM events and attributes forward to the <button>, chained with press (RAC GlobalDOMAttributes)", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/button");
  assert.equal(await page.getAttribute("#b-dom", "lang"), "en");
  assert.equal(await page.getAttribute("#b-dom", "dir"), "ltr");
  await page.hover("#b-dom");
  await waitText(page, "#b-log", "enter");
  await page.click("#b-dom");
  await waitText(page, "#b-log", "enter down:0 dom-press");
  await page.dblclick("#b-dom");
  await page.waitForFunction(() => document.querySelector("#b-log")!.textContent!.includes("dbl"));
  await page.click("#b-dom", { button: "right" });
  await page.waitForFunction(() => document.querySelector("#b-log")!.textContent!.includes("menu"));
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => document.querySelector("#b-log")!.textContent!.endsWith("leave"));
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("button: forwarded DOM events with a signal isPending and JSX children render and resume", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/button");
  assert.equal(await page.textContent("#b-jsx b"), "Bold");
  await page.hover("#b-jsx");
  await page.waitForTimeout(800);
  assert.equal(await page.textContent("#b-log"), "jsx-enter");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
