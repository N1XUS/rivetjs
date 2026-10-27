// PressableFeedback on a resumed page (`/pressable-feedback`; Rivet addition, feature set inspired by HeroUI Pro's public
// Pressable Feedback docs): a cold press ripples (`data-pressed`, position variables), a held press completes the hold
// confirm (`data-complete`, onComplete count) and a release resets it, a cold press on the progress button runs to
// `data-complete` and resets; keyboard Space holds too.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("pressable feedback: cold ripple, hold confirm, progress, keyboard hold", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 900 } });
  await page.goto(s.origin + "/pressable-feedback");
  await page.waitForLoadState("networkidle");
  const box = (await page.locator("#pf-ripple").boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.waitForSelector("#pf-ripple .pressable-feedback__ripple[data-pressed=true]");
  const x = await page.evaluate(() =>
    (document.querySelector("#pf-ripple .pressable-feedback__ripple") as HTMLElement).style.getPropertyValue("--pressable-feedback-ripple-x"),
  );
  assert.ok(Math.abs(parseFloat(x) - 10) < 3, x);
  await page.mouse.up();
  await page.waitForSelector("#pf-ripple .pressable-feedback__ripple[data-released=true]");

  const hold = (await page.locator("#pf-hold").boundingBox())!;
  await page.mouse.move(hold.x + hold.width / 2, hold.y + hold.height / 2);
  await page.mouse.down();
  await page.waitForSelector("#pf-hold .pressable-feedback__hold-confirm[data-holding=true]");
  await page.waitForFunction(() => document.querySelector("#pf-held")?.textContent === "1");
  assert.equal(await page.locator("#pf-hold .pressable-feedback__hold-confirm").getAttribute("data-complete"), "true");
  await page.mouse.up();
  await page.waitForSelector("#pf-hold .pressable-feedback__hold-confirm:not([data-complete])");

  await page.focus("#pf-hold");
  await page.keyboard.down("Space");
  await page.waitForFunction(() => document.querySelector("#pf-held")?.textContent === "2");
  await page.keyboard.up("Space");

  await page.click("#pf-progress");
  await page.waitForSelector("#pf-progress .pressable-feedback__progress-feedback[data-progressing=true]");
  await page.waitForFunction(() => document.querySelector("#pf-sent")?.textContent === "1");
  await page.waitForSelector("#pf-progress .pressable-feedback__progress-feedback:not([data-complete]):not([data-progressing])");
  await page.close();
});
