// PressableFeedback on a resumed page (`/pressable-feedback`; Rivet addition, feature set inspired by HeroUI Pro's public
// Pressable Feedback docs): a cold press ripples (`data-pressed`, position variables), a held press completes the hold
// confirm (`data-complete`, onComplete count) and a release resets it, a cold press on the progress button runs to
// `data-complete` and resets; keyboard Space holds too. A standalone Ripple inside a ui Button (`#pf-button`) ripples on a
// cold page's first mouse press (at the pointer) and first keyboard Space (centred), each on a fresh page; the same in the
// selectable cards `#pf-checks` / `#pf-radios`, whose keyboard focus sits on the hidden input (Space there ripples the card).
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

test("pressable feedback: standalone ripple in a ui Button, cold mouse and cold Space", async () => {
  const ripple = "#pf-button [data-slot=pressable-feedback-ripple]";
  const prop = (page: import("playwright").Page, name: string) =>
    page.evaluate(([sel, n]) => (document.querySelector(sel!) as HTMLElement).style.getPropertyValue(n!), [ripple, name]);
  const mouse = await s.browser.newPage({ viewport: { width: 1000, height: 900 } });
  await mouse.goto(s.origin + "/pressable-feedback");
  await mouse.waitForLoadState("networkidle");
  const box = (await mouse.locator("#pf-button").boundingBox())!;
  await mouse.mouse.move(box.x + 12, box.y + 10);
  await mouse.mouse.down();
  await mouse.waitForSelector(`${ripple}[data-pressed=true]`);
  assert.ok(Math.abs(parseFloat(await prop(mouse, "--pressable-feedback-ripple-x")) - 12) < 3);
  await mouse.mouse.up();
  await mouse.waitForSelector(`${ripple}[data-released=true]`);
  await mouse.close();

  const key = await s.browser.newPage({ viewport: { width: 1000, height: 900 } });
  await key.goto(s.origin + "/pressable-feedback");
  await key.waitForLoadState("networkidle");
  await key.focus("#pf-button");
  await key.keyboard.press("Space");
  await key.waitForSelector(`${ripple}[data-pressed=true]`);
  await key.waitForSelector(`${ripple}[data-released=true]`);
  const width = (await key.locator(ripple).boundingBox())!.width;
  assert.ok(Math.abs(parseFloat(await prop(key, "--pressable-feedback-ripple-x")) - width / 2) < 1);
  await key.close();
});

test("pressable feedback: standalone ripple in selectable cards, cold mouse and cold Space on the hidden input", async () => {
  for (const group of ["#pf-checks", "#pf-radios"]) {
    const ripple = `${group} [data-slot=pressable-feedback-ripple]`;
    const prop = (page: import("playwright").Page, name: string) =>
      page.evaluate(([sel, n]) => (document.querySelector(sel!) as HTMLElement).style.getPropertyValue(n!), [ripple, name]);
    const mouse = await s.browser.newPage({ viewport: { width: 1000, height: 900 } });
    await mouse.goto(s.origin + "/pressable-feedback");
    await mouse.waitForLoadState("networkidle");
    const card = mouse.locator(`${group} label`).first();
    const box = (await card.boundingBox())!;
    await mouse.mouse.move(box.x + 20, box.y + 12);
    await mouse.mouse.down();
    await mouse.waitForSelector(`${ripple}[data-pressed=true]`);
    assert.ok(Math.abs(parseFloat(await prop(mouse, "--pressable-feedback-ripple-x")) - 20) < 3, group);
    await mouse.mouse.up();
    await mouse.waitForSelector(`${ripple}[data-released=true]`);
    await mouse.waitForSelector(`${group} label[data-selected=true]`);
    await mouse.close();

    const key = await s.browser.newPage({ viewport: { width: 1000, height: 900 } });
    await key.goto(s.origin + "/pressable-feedback");
    await key.waitForLoadState("networkidle");
    await key.focus(`${group} input`);
    await key.keyboard.press("Space");
    await key.waitForSelector(`${ripple}[data-pressed=true]`);
    await key.waitForSelector(`${ripple}[data-released=true]`);
    await key.waitForSelector(`${group} label[data-selected=true]`);
    const width = (await key.locator(ripple).boundingBox())!.width;
    assert.ok(Math.abs(parseFloat(await prop(key, "--pressable-feedback-ripple-x")) - width / 2) < 1, group);
    await key.close();
  }
});
