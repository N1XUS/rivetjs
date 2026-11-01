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
  assert.equal(await page.locator("#formatted .markdown__caret").evaluate((el) => getComputedStyle(el).opacity), "0");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("markdown: streamed letters stay in natural flow without a height reveal", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/streaming-text");
  await page.click("#burst");
  await page.waitForSelector("#formatted .markdown__character");
  const content = await page.locator("#formatted").evaluate((root) => {
    const el = root as HTMLElement;
    return { height: el.style.height, overflow: getComputedStyle(el).overflow, box: el.getBoundingClientRect().height, streaming: el.dataset.streaming };
  });
  assert.equal(content.streaming, "true");
  assert.equal(content.height, "", "a pinned height hides arriving letters behind an accordion-like reveal");
  assert.notEqual(content.overflow, "clip");
  assert.ok(content.box > 0);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("markdown: character motion exactly matches StreamingText without an additional paragraph animation", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  await page.goto(s.origin + "/streaming-text");
  await page.click("#burst");
  await page.waitForSelector("#plain .streaming-text__character");
  await page.waitForSelector("#formatted .markdown__character");
  const motion = await page.evaluate(() => {
    const plain = document.querySelector("#plain .streaming-text__character")!;
    const markdown = document.querySelector("#formatted .markdown__character")!;
    const sample = (el: Element) => {
      const animation = el.getAnimations()[0];
      animation?.pause();
      if (animation) animation.currentTime = 100;
      const css = getComputedStyle(el);
      return {
        name: css.animationName,
        duration: css.animationDuration,
        easing: css.animationTimingFunction,
        fill: css.animationFillMode,
        opacity: css.opacity,
        keyframes: (animation?.effect as KeyframeEffect | null)?.getKeyframes(),
      };
    };
    const ancestors = [];
    for (let el = markdown.parentElement; el; el = el.parentElement) {
      const css = getComputedStyle(el);
      ancestors.push({ animation: css.animationName, opacity: css.opacity });
      if (el.id === "formatted") break;
    }
    return { plain: sample(plain), markdown: sample(markdown), ancestors };
  });
  assert.deepEqual(motion.markdown, motion.plain);
  assert.ok(motion.plain.keyframes?.length);
  assert.equal(
    motion.ancestors.every((node) => node.animation === "none" && node.opacity === "1"),
    true,
    JSON.stringify(motion.ancestors),
  );
  const glyph = await page.locator("#formatted .markdown__character").first().elementHandle();
  await page.click("#finish");
  await page.waitForFunction(() => document.querySelector("#formatted")?.getAttribute("data-streaming") !== "true");
  assert.equal(await glyph!.evaluate((el) => el.isConnected), true, "completion must preserve the same animated character");
  assert.equal(await glyph!.evaluate((el) => getComputedStyle(el).animationName), motion.plain.name);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("markdown: streaming caret is a thin vertical line with a continuous opacity blink", async () => {
  const page = await s.browser.newPage();
  await page.goto(s.origin + "/streaming-text");
  await page.click("#burst");
  await page.waitForSelector("#formatted .markdown__caret");
  const caret = await page.locator("#formatted .markdown__caret").evaluate((el) => {
    const box = el.getBoundingClientRect();
    const animation = el.getAnimations()[0]!;
    const duration = Number(animation.effect!.getTiming().duration);
    animation.pause();
    const opacity = (time: number) => {
      animation.currentTime = time;
      return Number(getComputedStyle(el).opacity);
    };
    return { width: box.width, height: box.height, duration, high: opacity(0), middle: opacity(duration / 4), low: opacity(duration / 2) };
  });
  assert.ok(caret.width <= 2 && caret.height >= caret.width * 5, JSON.stringify(caret));
  assert.ok(caret.duration >= 1000);
  assert.ok(caret.low < caret.middle && caret.middle < caret.high, "the blink must fade through intermediate opacity instead of switching abruptly");
  await page.click("#finish");
  await page.waitForFunction(() => !document.querySelector("#formatted .markdown__caret"));
  await page.close();
});
