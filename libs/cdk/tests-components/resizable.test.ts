// Resizable (react-resizable-panels 4.14.3 port) on a resumed page (story `/resizable`, production build, real
// Chromium): server markup (flex-basis / flex-grow from the first byte, cookie-stored layout), nothing runs at load
// (no `data-boot`), then a cold focus + arrow key, a cold hover + pointer drag (trusted CDP mouse input), a nested
// vertical group, the imperative panel ref and the cookie round trip.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { expandTail } from "@rivetjs/runtime/resume-format";
import { libraryScripts, stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

const open = async (cookie?: string, refKind = "panel") => {
  const context = await s.browser.newContext({ viewport: { width: 1000, height: 900 } });
  if (cookie) await context.addCookies([{ name: encodeURIComponent("react-resizable-panels:story"), value: encodeURIComponent(cookie), url: s.origin }]);
  const page = await context.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/resizable?ref=" + refKind);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  return { page, seen, close: () => context.close() };
};
const grow = (page: Page, id: string) => page.evaluate((id) => Number(document.getElementById(id)!.style.flexGrow), id);
const width = (page: Page, id: string) => page.evaluate((id) => document.getElementById(id)!.getBoundingClientRect().width, id);
const height = (page: Page, id: string) => page.evaluate((id) => document.getElementById(id)!.getBoundingClientRect().height, id);
const center = (page: Page, id: string) =>
  page.evaluate((id) => {
    const r = document.getElementById(id)!.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, id);

/** Trusted mouse input through CDP (Playwright `page.mouse` drags have hung in this repo). */
const drag = async (page: Page, from: { x: number; y: number }, dx: number, dy: number) => {
  const cdp = await page.context().newCDPSession(page);
  // moves while pressed carry `button: "left"` (as Playwright does); `"none"` + buttons 1 makes Chrome drop the capture
  const mouse = (type: "mouseMoved" | "mousePressed" | "mouseReleased", x: number, y: number, buttons = 0) =>
    cdp.send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" && !buttons ? "none" : "left", buttons, clickCount: 1 });
  await mouse("mouseMoved", from.x, from.y);
  await mouse("mousePressed", from.x, from.y, 1);
  for (let i = 1; i <= 5; i++) await mouse("mouseMoved", from.x + (dx * i) / 5, from.y + (dy * i) / 5, 1);
  await mouse("mouseReleased", from.x + dx, from.y + dy);
  await cdp.detach();
};

test("server markup: panel sizes from the first byte; separators focusable, no aria-valuenow before mount", async () => {
  const html = await (await fetch(s.origin + "/resizable")).text();
  assert.match(/<div[^>]*id="left"[^>]*>/.exec(html)?.[0] ?? "", /flex-basis:\s*30%/);
  assert.match(/<div[^>]*id="top"[^>]*>/.exec(html)?.[0] ?? "", /flex-basis:\s*50%/);
  const sep = /<div[^>]*id="sep-h"[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(sep, /role="separator"/);
  assert.match(sep, /tabindex="0"/);
  assert.doesNotMatch(sep, /aria-valuenow/);
  const cookie = await (
    await fetch(s.origin + "/resizable", { headers: { cookie: "react-resizable-panels%3Astory=" + encodeURIComponent('{"pa":20,"pb":80}') } })
  ).text();
  assert.match(/<div[^>]*id="pa"[^>]*>/.exec(cookie)?.[0] ?? "", /flex-grow:\s*20/);
});

test("cold: nothing boots at load; the panels lay out from the server styles", async () => {
  const { page, seen, close } = await open();
  assert.equal(await page.locator("script[data-boot]").count(), 0, "nothing boots at load");
  assert.deepEqual(libraryScripts(seen), [], "no library code before the first input");
  assert.equal(await page.locator("#sep-h").getAttribute("aria-valuenow"), null, "no resizable code ran");
  const tail = expandTail(JSON.parse((await page.locator('script[type="rivet/boundaries"]').textContent())!));
  const deferredId = Number(await page.locator("#deferred").getAttribute("data-b"));
  assert.ok(tail.b.find((record) => record[0] === deferredId)![2] & 256, "a group without imperative refs can still defer");
  assert.ok(Math.abs((await width(page, "left")) - 0.3 * ((await width(page, "left")) + (await width(page, "right")) + 8)) < 4);
  assert.deepEqual(seen.errors, []);
  await close();
});

test("cold: the imperative group ref sets the layout on the first click", async () => {
  const { page, seen, close } = await open(undefined, "group");
  assert.equal(await page.locator("script[data-boot]").count(), 0);
  await page.click("#resize-group");
  await page.waitForFunction(() => Number(document.getElementById("left")!.style.flexGrow) === 20);
  assert.equal(await grow(page, "right"), 80);
  assert.deepEqual(seen.errors, []);
  await close();
});

test("cold: a plain object panel ref resizes on the first click", async () => {
  const { page, seen, close } = await open(undefined, "manual");
  assert.equal(await page.locator("script[data-boot]").count(), 0);
  await page.click("#resize-manual-ref");
  await page.waitForFunction(() => Number(document.getElementById("top")!.style.flexGrow) === 20);
  assert.equal(await grow(page, "bottom"), 80);
  assert.deepEqual(seen.errors, []);
  await close();
});

test("cold: an arbitrary callback panel ref collapses on the first click", async () => {
  const { page, seen, close } = await open(undefined, "callback");
  assert.equal(await page.locator("script[data-boot]").count(), 0);
  await page.click("#collapse");
  await page.waitForFunction(() => Number(document.getElementById("left")!.style.flexGrow) === 5);
  assert.deepEqual(seen.errors, []);
  await close();
});

test("cold: focus + ArrowRight resizes (the activating key is not lost)", async () => {
  const { page, seen, close } = await open();
  await page.focus("#sep-h");
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.getElementById("sep-h")!.getAttribute("aria-valuenow") === "35");
  assert.equal(await grow(page, "left"), 35);
  await page.waitForFunction(() => document.getElementById("resized")!.textContent !== "");
  assert.deepEqual(JSON.parse((await page.locator("#resized").textContent())!), { left: 35, right: 65 });
  await page.keyboard.press("Home");
  await page.waitForFunction(() => document.getElementById("sep-h")!.getAttribute("aria-valuenow") === "5");
  assert.equal(await page.locator("#sep-h").getAttribute("data-separator"), "focus");
  assert.deepEqual(seen.errors, []);
  await close();
});

test("cold: hover + pointer drag resizes; a nested vertical group drags on its own axis", async () => {
  const { page, seen, close } = await open();
  const before = await width(page, "left");
  await drag(page, await center(page, "sep-h"), 100, 0);
  await page.waitForFunction((before) => document.getElementById("left")!.getBoundingClientRect().width > before + 80, before);
  // released 100px off the separator: hover ended; a drag releases keyboard focus (upstream)
  assert.equal(await page.locator("#sep-h").getAttribute("data-separator"), "inactive");
  const top = await height(page, "top");
  await drag(page, await center(page, "sep-v"), 0, -40);
  await page.waitForFunction((top) => document.getElementById("top")!.getBoundingClientRect().height < top - 30, top);
  assert.deepEqual(seen.errors, []);
  await close();
});

test("cold: the imperative panel ref collapses; a drag persists the layout to the cookie, server-rendered on reload", async () => {
  const { page, seen, close } = await open('{"pa":40,"pb":60}');
  assert.equal(await grow(page, "pa"), 40);
  await page.click("#collapse");
  await page.waitForFunction(() => Number(document.getElementById("left")!.style.flexGrow) === 5);
  await drag(page, await center(page, "sep-p"), 100, 0);
  await page.waitForFunction(() => /react-resizable-panels%3Astory=/.test(document.cookie));
  const stored = await page.evaluate(() => JSON.parse(decodeURIComponent(/react-resizable-panels%3Astory=([^;]*)/.exec(document.cookie)![1]!)));
  assert.ok(stored.pa > 45, JSON.stringify(stored));
  await page.reload();
  await page.waitForLoadState("networkidle");
  assert.ok(Math.abs((await grow(page, "pa")) - stored.pa) < 0.01);
  assert.deepEqual(seen.errors, []);
  await close();
});
