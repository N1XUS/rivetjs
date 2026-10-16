// RAC color components on a resumed page (route `/color`): server markup (gradients, thumb positions, hidden
// inputs, labels) and, after resume, thumb drag + keyboard on ColorArea / ColorSlider / ColorWheel, typing in
// ColorField, and a ColorPicker keeping its children in sync.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("color: server HTML", async () => {
  const html = await (await fetch(s.origin + "/color")).text();
  assert.match(html, /class="rv-ColorArea"[^>]*role="group"|role="group"[^>]*class="rv-ColorArea"/);
  assert.match(html, /linear-gradient/);
  assert.match(html, /conic-gradient/);
  // HTML attribute names render lowercase on the server (`inputMode` → `inputmode`, runtime server.ts).
  assert.match(html, /<input[^>]*inputmode="numeric"[^>]*value="0°"/);
  assert.match(html, /aria-roledescription="2D slider"/);
  assert.match(html, /<input[^>]*id="hex-input"[^>]*value="#FF0000"|<input[^>]*value="#FF0000"[^>]*id="hex-input"/);
  assert.match(html, /<output[^>]*id="hue-output"[^>]*>(<!--[^>]*-->)*0°/);
  assert.match(html, /role="listbox"[^>]*aria-label="Color swatches"|aria-label="Color swatches"[^>]*role="listbox"/);
  assert.match(html, /id="picker-swatch"[^>]*role="img"[^>]*aria-roledescription="color swatch"[^>]*aria-label="dark vibrant cyan blue"/);
});

test("color: resumed page — keys and drags on area / slider / wheel, field typing, picker sync", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/color");

  // ColorArea: keyboard on the x input, then a drag of the thumb.
  await page.focus("#area input[type=range]");
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector("#area-value")?.textContent === "rgb(1, 0, 0)");
  const areaBox = (await page.locator("#area").boundingBox())!;
  await page.mouse.move(areaBox.x + areaBox.width / 2, areaBox.y + areaBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(areaBox.x + areaBox.width, areaBox.y + areaBox.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(() => /^rgb\(255, 12[78], 0\)$/.test(document.querySelector("#area-value")?.textContent ?? ""));

  // ColorSlider: Page key, then a thumb drag to the middle.
  await page.focus("#hue-track input[type=range]");
  await page.keyboard.press("PageUp");
  await page.waitForFunction(() => document.querySelector("#hue-value")?.textContent === "15");
  await page.waitForFunction(() => document.querySelector("#hue-output")?.textContent === "15°");
  const sliderThumb = (await page.locator("#hue-track .rv-ColorThumb").boundingBox())!;
  const trackBox = (await page.locator("#hue-track").boundingBox())!;
  await page.mouse.move(sliderThumb.x + sliderThumb.width / 2, sliderThumb.y + sliderThumb.height / 2);
  await page.mouse.down();
  await page.mouse.move(trackBox.x + trackBox.width / 2, sliderThumb.y + sliderThumb.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(() => Math.abs(Number(document.querySelector("#hue-value")?.textContent) - 180) <= 2);

  // Channel ColorField over the same Signal: ArrowUp increments the hue by 1.
  const hueBefore = Number(await page.textContent("#hue-value"));
  await page.focus("#hue-field input");
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction((h) => Number(document.querySelector("#hue-value")?.textContent) === h + 1, hueBefore);

  // ColorWheel: arrow key, then drag the thumb a quarter turn.
  await page.focus("#wheel input[type=range]");
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector("#wheel-value")?.textContent === "1");
  const wheelBox = (await page.locator("#wheel .rv-ColorWheelTrack").boundingBox())!;
  const cx = wheelBox.x + wheelBox.width / 2;
  const cy = wheelBox.y + wheelBox.height / 2;
  await page.mouse.move(cx + 87, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy + 87, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector("#wheel-value")?.textContent === "90");

  // ColorField: type a hex value, commit with Enter; arrow increments.
  await page.fill("#hex-input", "");
  await page.type("#hex-input", "00ff00");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#hex-value")?.textContent === "#00FF00");
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction(() => document.querySelector("#hex-value")?.textContent === "#00FF01");

  // ColorSwatchPicker in the ColorPicker: SSR selection, click → picker; arrow + Enter.
  assert.equal(await page.getAttribute("#swatches [role=option][data-key='#3366CCFF']", "aria-selected"), "true");
  await page.click("#swatches [role=option][data-key='#00FF00FF']");
  await page.waitForFunction(() => document.querySelector("#picked-value")?.textContent === "#00FF00");
  await page.waitForFunction(() => (document.querySelector("#picker-input") as HTMLInputElement | null)?.value === "#00FF00");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#picked-value")?.textContent === "#FF0000");

  // ColorPicker: the field drives the picker; the slider follows.
  await page.fill("#picker-input", "");
  await page.type("#picker-input", "ff0000");
  await page.keyboard.press("Tab");
  await page.waitForFunction(() => document.querySelector("#picked-value")?.textContent === "#FF0000");
  await page.waitForFunction(() => (document.querySelector("#picker-track input") as HTMLInputElement | null)?.value === "0");
  await page.focus("#picker-track input[type=range]");
  await page.keyboard.press("PageUp");
  await page.waitForFunction(() => document.querySelector("#picked-value")?.textContent === "#FF4000");
  await page.waitForFunction(() => (document.querySelector("#picker-input") as HTMLInputElement | null)?.value === "#FF4000");
  // No swatch matches #FF4000: none selected.
  await page.waitForFunction(() => !document.querySelector("#swatches [aria-selected=true]"));

  assert.deepEqual(seen.errors, []);
  await page.close();
});

// FieldErrorContext value must resume (G-PAR/K): the resumed ColorField's FieldError renders its validation.
test("color field: FieldError renders after resume", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/color");
  assert.equal(await page.locator(".rv-ColorField:has(#brand-input) .rv-FieldError").count(), 0);
  await page.fill("#brand-input", "");
  await page.type("#brand-input", "000000");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector(".rv-ColorField:has(#brand-input) .rv-FieldError")?.textContent === "Pick a lighter color");
  assert.equal(await page.getAttribute("#brand-input", "aria-invalid"), "true");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
