// ToggleButtonGroup / Meter / ProgressBar / FileTrigger on a resumed page (stories `/toggle-button-group`,
// `/progress`): server markup (roles, aria-checked / aria-pressed, labels, values), no library JS before
// interaction, then selection, keyboard navigation, accessor-driven progress and file selection after resume.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, libraryScripts, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const attrs = (page: import("playwright").Page, selector: string, names: string[]) =>
  page.$$eval(selector, (els, names) => els.map((el) => names.map((n) => el.getAttribute(n))), names);
// Resumed handlers load on the first interaction: wait for the DOM to settle before asserting.
const until = (page: import("playwright").Page, selector: string, name: string, values: (string | null)[]) =>
  page.waitForFunction(
    ([selector, name, values]) =>
      JSON.stringify([...document.querySelectorAll(selector as string)].map((el) => el.getAttribute(name as string))) === JSON.stringify(values),
    [selector, name, values] as const,
  );

test("toggle button group: server markup and resumed selection", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/toggle-button-group");
  // Server markup.
  assert.equal(await page.getAttribute("#tbg-align", "role"), "radiogroup");
  assert.equal(await page.getAttribute("#tbg-align", "class"), "rv-ToggleButtonGroup");
  assert.equal(await page.getAttribute("#tbg-align", "data-orientation"), "horizontal");
  assert.deepEqual(await attrs(page, "#tbg-align button", ["role", "aria-checked", "aria-pressed", "id"]), [
    ["radio", "true", null, null],
    ["radio", "false", null, null],
    ["radio", "false", null, null],
  ]);
  assert.equal(await page.getAttribute("#tbg-format", "role"), "toolbar");
  assert.deepEqual(await attrs(page, "#tbg-format button", ["aria-pressed", "disabled"]), [
    ["true", null],
    ["false", null],
    ["false", ""],
  ]);
  assert.equal(await page.getAttribute("#tbg-vertical", "aria-disabled"), "true");
  assert.equal(await page.getAttribute("#tbg-vertical", "data-disabled"), "true");
  assert.equal(await page.getAttribute("#tbg-vertical", "aria-orientation"), "vertical");
  assert.deepEqual(libraryScripts(seen), [], "no library code before interaction");

  // Single selection after resume.
  await page.click("#tbg-align button:nth-child(2)");
  await until(page, "#tbg-align button", "aria-checked", ["false", "true", "false"]);
  assert.equal(await page.textContent("#tbg-align-last"), "center");
  // disallowEmptySelection: clicking the selected one keeps it.
  await page.click("#tbg-align button:nth-child(2)");
  assert.deepEqual(await attrs(page, "#tbg-align button", ["aria-checked"]), [["false"], ["true"], ["false"]]);
  // Arrow keys move focus (toolbar).
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Right");
  await page.keyboard.press("Space");
  await until(page, "#tbg-align button", "aria-checked", ["false", "false", "true"]);

  // Multiple selection with a two-way signal.
  await page.click("#tbg-format button:nth-child(2)");
  await until(page, "#tbg-format button", "aria-pressed", ["true", "true", "false"]);
  assert.equal(await page.textContent("#tbg-format-value"), "bold,italic");
  await page.click("#tbg-format button:nth-child(1)");
  assert.equal(await page.textContent("#tbg-format-value"), "italic");
  assert.deepEqual(await attrs(page, "#tbg-format button", ["aria-pressed"]), [["false"], ["true"], ["false"]]);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("meter / progress bar / file trigger: server markup and resumed updates", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/progress");
  assert.equal(await page.getAttribute("#storage", "role"), "meter");
  assert.equal(await page.getAttribute("#storage", "class"), "rv-Meter");
  assert.equal(await page.getAttribute("#storage", "aria-valuetext"), "60%");
  const meterLabel = await page.getAttribute("#storage", "aria-labelledby");
  assert.equal(await page.textContent(`#${meterLabel}`), "Storage space");
  assert.equal(await page.evaluate(() => document.getElementById(document.getElementById("storage")!.getAttribute("aria-labelledby")!)!.localName), "span");
  assert.equal(await page.$eval("#storage .bar", (el) => (el as HTMLElement).style.width), "60%");

  assert.equal(await page.getAttribute("#upload", "role"), "progressbar");
  assert.equal(await page.getAttribute("#upload", "aria-valuenow"), "25");
  assert.equal(await page.getAttribute("#busy", "aria-valuenow"), null);
  assert.equal(await page.getAttribute("#busy", "aria-label"), "Loading");
  assert.equal(
    await page.$eval('input[type="file"]', (el) =>
      [(el as HTMLInputElement).style.display, el.getAttribute("accept"), el.hasAttribute("multiple"), el.getAttribute("data-testid")].join("|"),
    ),
    "none|text/plain|true|files",
  );
  assert.deepEqual(libraryScripts(seen), [], "no library code before interaction");

  await page.click("#advance");
  await until(page, "#upload", "aria-valuenow", ["50"]);
  assert.equal(await page.getAttribute("#upload", "aria-valuenow"), "50");
  assert.equal(await page.textContent("#upload .value"), "50%");
  assert.equal(await page.$eval("#upload .bar", (el) => (el as HTMLElement).style.width), "50%");

  // FileTrigger: pressing the button opens the chooser (the hidden input's click), selection reaches onSelect.
  const chooser = page.waitForEvent("filechooser");
  await page.click("#pick");
  const fc = await chooser;
  assert.equal(fc.isMultiple(), true);
  await fc.setFiles([
    { name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("a") },
    { name: "b.txt", mimeType: "text/plain", buffer: Buffer.from("b") },
  ]);
  await page.waitForFunction(() => document.getElementById("files-value")?.textContent !== "none");
  assert.equal(await page.textContent("#files-value"), "a.txt,b.txt");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
