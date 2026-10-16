// Slider / NumberField on a resumed page (stories `/slider`, `/number-field`, lane C4a): server markup (roles,
// labels, values, fill / thumb positions, hidden input), no library JS before interaction, then after resume: label
// click (sliderProps `onClick` bag handler), keys, thumb drag, track click; NumberField typing + Enter, arrows,
// stepper presses, wheel. Stepped slider: free drag + animated snap on release (Rivet `snap="release"`).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, libraryScripts, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const text = (page: import("playwright").Page, selector: string, value: string) =>
  page.waitForFunction(([selector, value]) => document.querySelector(selector)?.textContent === value, [selector, value] as const);

test("slider: server markup", async () => {
  const html = await (await fetch(s.origin + "/slider")).text();
  assert.match(html, /<div[^>]*role="group"[^>]*class="rv-Slider"|class="rv-Slider"[^>]*role="group"/);
  assert.match(html, /<output[^>]*id="volume-output"[^>]*>(<!--[^>]*-->)*30/);
  assert.match(html, /type="range"/);
  assert.match(html, /aria-valuetext="30"/);
  assert.match(html, /left:\s*30%/);
  assert.match(html, /<output[^>]*id="range-output"[^>]*>(<!--[^>]*-->)*20%\s?[–-]\s?60%/);
});

test("slider: resumed — label click, keys, thumb drag, track click", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/slider");
  assert.deepEqual(libraryScripts(seen), [], "no library code before interaction");

  // Label click focuses the first thumb (RA label onClick).
  await page.click("#volume label");
  await page.waitForFunction(() => (document.activeElement as HTMLInputElement | null)?.type === "range");
  await page.keyboard.press("ArrowRight");
  await text(page, "#volume-value", "31");
  await text(page, "#volume-output", "31");
  await page.keyboard.press("PageUp");
  await text(page, "#volume-value", "41");

  // Thumb drag to the end of the track.
  const thumb = (await page.locator("#volume-track .rv-SliderThumb").boundingBox())!;
  const track = (await page.locator("#volume-track").boundingBox())!;
  await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width + 20, thumb.y + thumb.height / 2, { steps: 5 });
  await page.mouse.up();
  await text(page, "#volume-value", "100");

  // Track click moves the closest thumb of the range slider.
  const rangeTrack = (await page.locator("#range-track").boundingBox())!;
  await page.mouse.click(rangeTrack.x + rangeTrack.width * 0.9, rangeTrack.y + rangeTrack.height / 2);
  await text(page, "#range-value", "0.2,0.9");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("slider: resumed — stepped thumb drags freely, snaps to the step on release", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/slider");
  assert.equal(await page.locator("#stepped .rv-SliderThumb[data-snapping]").count(), 0);
  const thumbEl = page.locator("#stepped-track .rv-SliderThumb");
  const thumb = (await thumbEl.boundingBox())!;
  const track = (await page.locator("#stepped-track").boundingBox())!;
  const y = thumb.y + thumb.height / 2;
  await page.mouse.move(thumb.x + thumb.width / 2, y);
  await page.mouse.down();
  // Wait for the resumed handlers before moving (first pointerdown loads the chunks).
  await page.waitForFunction(() => document.querySelector("#stepped .rv-SliderThumb")?.hasAttribute("data-dragging"));
  await page.mouse.move(track.x + track.width * 0.37, y, { steps: 6 });
  await text(page, "#stepped-output", "40");
  const free = await thumbEl.evaluate((el) => parseFloat((el as HTMLElement).style.left));
  assert.ok(Math.abs(free - 37) < 2, `free position ${free}% follows the pointer`);
  await page.mouse.up();
  await page.waitForFunction(() => (document.querySelector("#stepped .rv-SliderThumb") as HTMLElement).style.left === "40%");
  await page.waitForFunction(() => !document.querySelector("#stepped .rv-SliderThumb")!.hasAttribute("data-snapping"));
  await text(page, "#stepped-output", "40");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("number field: server markup", async () => {
  const html = await (await fetch(s.origin + "/number-field")).text();
  assert.match(html, /class="rv-NumberField"/);
  assert.match(html, /<input[^>]*value="1,024"/);
  assert.match(html, /aria-roledescription="Number field"/);
  assert.match(html, /aria-label="Increase"/);
  assert.match(html, /<input[^>]*type="hidden"[^>]*name="price"[^>]*value="25"|<input[^>]*name="price"[^>]*type="hidden"/);
  assert.match(html, /<input[^>]*value="\$25\.00"/);
});

test("number field: resumed — typing, Enter, arrows, steppers, wheel", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/number-field");
  assert.deepEqual(libraryScripts(seen), [], "no library code before interaction");
  const input = "#width"; // RAC: `id` names the input

  await page.click(input);
  // Open question (lane R): keys typed while the resume chunks load are sometimes lost; wait for them here.
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("2048");
  await page.keyboard.press("Enter");
  await text(page, "#width-value", "2048");
  assert.equal(await page.inputValue(input), "2,048");

  await page.keyboard.press("ArrowUp");
  await text(page, "#width-value", "2049");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await text(page, "#width-value", "2047");

  await page.click("[aria-controls=width][slot=increment]");
  await text(page, "#width-value", "2048");
  await page.click("[aria-controls=width][slot=decrement]");
  await text(page, "#width-value", "2047");

  // Wheel while focus is within the group (focus is on the input after the mouse press).
  await page.focus(input);
  await page.hover(input);
  await page.mouse.wheel(0, 10);
  await text(page, "#width-value", "2048");

  // Hidden form input follows the price field.
  await page.click("[aria-controls=price][slot=increment]");
  await page.waitForFunction(() => (document.querySelector("#price-form input[name=price]") as HTMLInputElement | null)?.value === "26");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

// FieldErrorContext value must resume (G-PAR/K): with a const-arrow value the resumed NumberField's FieldError
// never saw the validation (same bug as ComboBox / SearchField, K1).
test("number field: FieldError renders after resume", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/number-field");
  const error = ".rv-NumberField:has(#limit) .rv-FieldError";
  assert.equal(await page.locator(error).count(), 0);
  await page.click("#limit");
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("20");
  await page.keyboard.press("Enter");
  await page.waitForFunction((selector) => document.querySelector(selector)?.textContent === "At most 10", error);
  assert.equal(await page.getAttribute("#limit", "aria-invalid"), "true");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
