// AI chat components on a resumed page (`/ai-chat`; Rivet additions, feature sets inspired by HeroUI Pro's public AI
// docs): nothing boots at rest (no `data-boot`; markdown / highlighter modules not loaded); the conversation starts at the bottom (scroll button
// hidden); typing + Enter appends the user turn and streams a local fake reply into the live Markdown (caret while
// streaming, finished turn after); Send turns into Stop while streaming; ChainOfThought toggles; two inline sources each preview their own source; 375 px no horizontal scroll.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { nonRuntimeScripts, stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("ai chat: no boot at rest, no parser / highlighter JS", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 800 } });
  const seen = watch(page);
  await page.goto(s.origin + "/ai-chat");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.evaluate(() => document.querySelector("[data-boot]") === null), true);
  // Documented (libs/ui/CLAUDE.md Known diffs): cdk Button / Link resume chunks are preloaded at load (no boot, no execution
  // order dependency); the parser / highlighter modules are not among them (markdown + code render on the server).
  assert.deepEqual(
    nonRuntimeScripts(seen).filter((u) => /\/(markdown|highlight|chat-loader)-/.test(u)),
    [],
  );
  assert.equal(await page.getAttribute("#conv", "data-at-bottom"), "true");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#to-bottom")!).visibility), "hidden");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#conv")!).flexDirection), "column-reverse");
  assert.equal(await page.getAttribute("#send", "aria-label"), "Send message");
  assert.equal(await page.evaluate(() => (document.querySelector("#send") as HTMLButtonElement).disabled), true);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("ai chat: submit streams a local reply", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 800 } });
  const seen = watch(page);
  await page.goto(s.origin + "/ai-chat");
  await page.waitForLoadState("networkidle");
  await page.click("#prompt");
  await page.keyboard.type("Hi there");
  await page.waitForFunction(() => !(document.querySelector("#send") as HTMLButtonElement).disabled);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.getElementById("status")!.textContent === "streaming");
  assert.equal(await page.inputValue("#prompt"), "");
  assert.equal(await page.getAttribute("#send", "aria-label"), "Stop generating");
  assert.equal(await page.getAttribute("#conv", "aria-busy"), "true");
  await page.waitForSelector("#live .markdown__caret");
  await page.waitForFunction(() => document.getElementById("status")!.textContent === "ready", undefined, { timeout: 10_000 });
  const last = await page.evaluate(() => {
    const turns = [...document.querySelectorAll("[data-turn]")];
    return turns.slice(-2).map((t) => [t.getAttribute("data-slot"), t.textContent]);
  });
  assert.match(last[0]![1]!, /Hi there/);
  assert.match(last[1]![1]!, /short version.*The server streams HTML.*Done\./s);
  assert.equal(await page.evaluate(() => document.querySelectorAll("[data-turn] strong").length >= 2), true);
  assert.equal(await page.$("#live"), null);
  assert.equal(await page.$(".markdown__caret"), null);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("ai chat: chain of thought toggles; 375 px", async () => {
  const page = await s.browser.newPage({ viewport: { width: 375, height: 800 } });
  await page.goto(s.origin + "/ai-chat");
  await page.waitForLoadState("networkidle");
  const trigger = "#cot [data-slot=chain-of-thought-trigger]";
  assert.equal(await page.getAttribute(trigger, "aria-expanded"), "false");
  await page.click(trigger);
  await page.waitForFunction((sel) => document.querySelector(sel)!.getAttribute("aria-expanded") === "true", trigger);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.close();
});

test("ai chat: two inline sources each show their own preview (resumed)", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 800 } });
  const seen = watch(page);
  await page.goto(s.origin + "/ai-chat");
  await page.waitForLoadState("networkidle");
  const preview = () => page.evaluate(() => [...document.querySelectorAll("[data-slot=chat-source-preview]")].map((el) => el.textContent));
  await page.hover("#cites a >> nth=0");
  await page.waitForFunction(() => /How resumed pages start/.test(document.querySelector("[data-slot=chat-source-preview]")?.textContent ?? ""));
  await page.mouse.move(5, 5);
  await page.waitForFunction(() => !document.querySelector("[data-slot=chat-source-preview]"));
  await page.hover("#cites a >> nth=1");
  await page.waitForFunction(() => /example\.org\/signals/.test(document.querySelector("[data-slot=chat-source-preview]")?.textContent ?? ""));
  const texts = await preview();
  assert.equal(texts.length, 1);
  assert.doesNotMatch(texts[0]!, /Resume guide/);
  assert.deepEqual(seen.errors, []);
  await page.close();
});
