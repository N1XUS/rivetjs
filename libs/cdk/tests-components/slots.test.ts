// `@rivetjs/cdk/slots` contracts on a resumed page (route `/slots`): server HTML of slotted parts and
// slot ids, slot contexts reaching re-created regions, reactive accessor context values, resumed
// PressResponder / Pressable.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("slots: server HTML of parts and slot ids", async () => {
  const html = await (await fetch(s.origin + "/slots")).text();
  // createSlotId (RA useSlotId): the server keeps the id, also for an input rendered before its description
  // and for one without any (RA's server HTML).
  assert.match(html, /id="d1-input"[^>]*aria-describedby="d1-desc"/);
  assert.match(html, /id="nd-input"[^>]*aria-describedby="nd-desc"/);
  assert.match(html, /<span[^>]*id="d1-desc"[^>]*>Help text<\/span>/);
  assert.match(html, /<h4[^>]*id="acc-heading"[^>]*>(<!--[^>]*-->)*October/);
  assert.match(html, /<hr[^>]*id="sep"[^>]*role="separator"/);
  assert.match(html, /<kbd[^>]*dir="ltr"[^>]*>/);
});

test("slots: resumed page — slot ids, re-created slotted parts, accessor context values, PressResponder", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/slots");
  // The page's records adopt at idle (derived resume, `DEFER`): the slot check runs then and drops an id without its
  // element (RA useSlotId's post-mount drop); present ones stay.
  await page.waitForSelector("#nd-input:not([aria-describedby])", { state: "attached" });
  await page.waitForSelector("#d2-input:not([aria-describedby])", { state: "attached" });
  assert.equal(await page.getAttribute("#d1-input", "aria-describedby"), "d1-desc");
  // Slot id follows its part after resume.
  await page.click("#d1-toggle");
  await page.waitForSelector("#d1-desc", { state: "detached" });
  await page.waitForSelector("#d1-input:not([aria-describedby])");
  await page.click("#d1-toggle");
  await page.waitForSelector("#d1-input[aria-describedby=d1-desc]");
  await page.click("#d2-toggle");
  await page.waitForSelector("#d2-input[aria-describedby=d2-desc]");
  // Slot contexts provided outside the region reach the re-created parts.
  await page.click("#sr-toggle");
  await page.waitForSelector("#sr-heading");
  assert.equal(await page.evaluate(() => document.querySelector("#sr-heading")!.tagName), "H2");
  assert.equal(await page.getAttribute("#sr-heading", "class"), "sr-h");
  assert.equal(await page.textContent("#sr-desc"), "Recreated description");
  // Accessor context values.
  await page.click("#title-next");
  await page.waitForFunction(() => document.querySelector("#acc-heading")?.textContent === "November");
  await page.click("#invalid-toggle");
  await page.waitForSelector("#ctx-input[data-invalid=true]");
  // createSlot: a resumed binding reading hasSlot() re-runs (serializable hasSlot), and follows the slot.
  assert.equal(await page.getAttribute("#hs-target", "aria-labelledby"), "hs-label");
  await page.click("#hs-inc");
  await page.waitForSelector("#hs-target[aria-valuenow='1'][aria-labelledby=hs-label]");
  // Removing the server-rendered slot element: needs the runtime ref reset on resumed regions (lane R, queued).
  // contextProps merged style function resumes and stays reactive.
  assert.match((await page.getAttribute("#ms-input", "style")) ?? "", /width: ?120px/);
  const before = await page.evaluate(() => (document.querySelector("#ms-input") as HTMLElement).style.color);
  assert.notEqual(before, "");
  await page.click("#ms-next");
  await page.waitForFunction((prev) => {
    const el = document.querySelector("#ms-input") as HTMLElement;
    return el.style.color !== prev && el.style.width === "120px";
  }, before);
  // PressResponder + Pressable.
  await page.click("#pressable");
  await page.waitForFunction(() => document.querySelector("#presses")?.textContent === "1");
  assert.deepEqual(seen.errors, []);
  await page.close();
});
