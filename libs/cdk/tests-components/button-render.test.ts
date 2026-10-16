// Button `render` prop (inline arrow) on the resumed story app: the rendered element resumes, a press runs,
// and the reactive `class` / `data-pressed` follow the press.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("button render: replaced element resumes; press works, class and data-pressed update", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/button-render");
  assert.equal(await page.evaluate(() => document.getElementById("rb")!.tagName), "BUTTON");
  assert.equal(await page.getAttribute("#rb", "class"), "off");
  const box = (await page.locator("#rb").boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + 2);
  await page.mouse.down();
  await page.waitForFunction(
    () => document.getElementById("rb")!.getAttribute("class") === "on" && document.getElementById("rb")!.getAttribute("data-pressed") === "true",
  );
  await page.mouse.up();
  await page.waitForFunction(
    () => document.getElementById("rb")!.getAttribute("class") === "off" && !document.getElementById("rb")!.hasAttribute("data-pressed"),
  );
  await page.waitForFunction(() => document.getElementById("rb-log")!.textContent!.includes("press"));
  assert.deepEqual(seen.errors, []);
  await page.close();
});
