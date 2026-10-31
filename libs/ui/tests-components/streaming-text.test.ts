import { afterAll, beforeAll, test } from "vitest";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("streaming text: cold burst reveals partial words, drains and can replay without idle boot", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/streaming-text");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator("[data-boot]").count(), 0);
  assert.equal(await page.locator("#initial").textContent(), "Existing 👩🏽‍💻 text");
  assert.equal(await page.locator("#initial [data-new]").count(), 0);
  // Observe before the first trusted click: the cold loader defers that click's DOM write.
  await page.evaluate(() => {
    const samples: string[] = [];
    (window as unknown as { revealSamples: string[] }).revealSamples = samples;
    const root = document.getElementById("plain")!;
    new MutationObserver(() => samples.push(root.textContent ?? "")).observe(root, { childList: true, subtree: true, characterData: true });
  });
  await page.click("#burst");
  await page.waitForSelector("#plain[data-revealing]");
  await page.click("#finish");
  await page.waitForFunction(() => document.getElementById("plain")!.textContent === "Hello world" && !document.querySelector("#formatted .markdown__caret"));
  const samples = await page.evaluate(() => (window as unknown as { revealSamples: string[] }).revealSamples);
  assert.equal(
    samples.some((text) => text.length > 0 && text.length < 5),
    true,
    JSON.stringify(samples),
  );
  assert.equal(await page.locator("#formatted p").textContent(), "Hello world");
  assert.equal(await page.locator("#scalar p").textContent(), "Hello world");
  assert.equal(await page.locator("#plain[data-revealing]").count(), 0);
  await page.click("#reset");
  await page.waitForFunction(() => document.getElementById("plain")!.textContent === "");
  await page.click("#burst");
  await page.waitForFunction(() => document.getElementById("plain")!.textContent === "Hello world");
  await mkdir(".artifacts/ui-components/streaming-text", { recursive: true });
  await page.screenshot({ path: ".artifacts/ui-components/streaming-text/complete.png" });
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("streaming text: reduced motion renders the complete burst immediately", async () => {
  const page = await s.browser.newPage({ reducedMotion: "reduce" });
  const seen = watch(page);
  await page.goto(s.origin + "/streaming-text");
  await page.click("#burst");
  await page.waitForFunction(() => document.getElementById("plain")!.textContent === "Hello world");
  assert.equal(await page.locator("#plain[data-revealing]").count(), 0);
  assert.equal(await page.locator("#formatted").textContent(), "Hello world");
  assert.equal(await page.locator("#plain").evaluate((root) => root.getAnimations({ subtree: true }).length), 0);
  assert.deepEqual(seen.errors, []);
  await page.close();
});
