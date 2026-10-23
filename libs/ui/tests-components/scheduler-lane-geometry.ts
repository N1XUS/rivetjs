// Real production lane geometry shared by the shipped-UI regression and the standalone CDK demo probe.
import assert from "node:assert/strict";
import type { Page } from "playwright";

export async function verifyLaneStartResize(page: Page, selector: string, rtl: boolean, assertModel: () => Promise<void>) {
  const cdp = await page.context().newCDPSession(page);
  let pointer = { x: 0, y: 0 };
  const release = () => cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...pointer, button: "left", buttons: 0, clickCount: 1 });
  const chip = page.locator(selector).first();
  const box = async () => {
    const value = await chip.boundingBox();
    assert.ok(value);
    return value;
  };
  await chip.scrollIntoViewIfNeeded();
  await chip.focus();
  await page.waitForLoadState("networkidle");
  const initial = await box();
  const width = await chip.evaluate((el) => el.closest("[data-rv-day-index]")!.getBoundingClientRect().width);
  const start = (value: typeof initial) => (rtl ? value.x + value.width : value.x);
  const end = (value: typeof initial) => (rtl ? value.x : value.x + value.width);
  const near = (actual: number, expected: number, label: string) => assert.ok(Math.abs(actual - expected) < 1.5, `${label}: ${actual} vs ${expected}`);
  const move = async (travel: number) => {
    await chip.locator('[data-edge="start"]').scrollIntoViewIfNeeded();
    const handle = await chip.locator('[data-edge="start"]').boundingBox();
    assert.ok(handle);
    const x = handle.x + handle.width / 2,
      y = handle.y + handle.height / 2;
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
    // Native mouse pointer capture proves the lazily loaded resize tracker is armed on this held press.
    await page.waitForFunction((selector) => document.querySelector(selector)?.hasPointerCapture(1), selector + ' [data-edge="start"]', { timeout: 5000 });
    for (let i = 1; i <= 6; i++) await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + (travel * i) / 6, y, button: "left", buttons: 1 });
    pointer = { x: x + travel, y };
    await page.locator(selector + '[data-resizing="start"]').waitFor({ timeout: 5000 });
    return box();
  };
  const travel = (rtl ? -1 : 1) * width;
  const preview = await move(travel);
  near(start(preview), start(initial) + travel, "dragged start follows target before pointerup");
  near(end(preview), end(initial), "opposite end stays pinned before pointerup");
  near(preview.width, initial.width - width, "start shortening removes exactly one day");
  await release();
  await page.locator(selector + "[data-resizing]").waitFor({ state: "detached" });
  await assertModel();
  const committed = await box();
  near(start(committed), start(preview), "committed start matches preview");
  near(end(committed), end(initial), "committed opposite end stays pinned");
  assert.equal(await chip.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--rv-scheduler-lane-shift")), "");
  const cancelledPreview = await move(-travel);
  near(start(cancelledPreview), start(committed) - travel, "cancelled gesture also previews the dragged start");
  near(end(cancelledPreview), end(committed), "cancelled gesture keeps opposite end pinned");
  await page.keyboard.press("Escape");
  await release();
  await page.locator(selector + "[data-resizing]").waitFor({ state: "detached" });
  await assertModel();
  const restored = await box();
  near(start(restored), start(committed), "Escape restores committed start");
  near(end(restored), end(committed), "Escape restores committed end");
  assert.equal(await chip.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--rv-scheduler-lane-shift")), "");
  const result = { rtl, width, initial, preview, committed, cancelledPreview, restored };
  console.info("[scheduler-lane-geometry]", JSON.stringify(result));
  await cdp.detach();
  return result;
}
