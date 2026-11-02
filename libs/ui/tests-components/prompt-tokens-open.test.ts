// PromptInput token suggestions (`/prompt-tokens-open`, production story build): the panel appears at its final place on the
// first open — only the entrance (fade + scale about its centre) animates, no slide. Before: `duration-(--popup-duration)` set
// `transition-duration` over the initial `transition-property: all`, and the caret was measured after the panel showed at its
// default place, so the first open slid ~40 px (later opens kept the measured place).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("token suggestions: first and second open render at the final place (centre drift ≤ 1 px)", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(s.origin + "/prompt-tokens-open", { waitUntil: "networkidle" });
    await page.click("#pt-text");
    for (const open of ["first", "second"]) {
      const frames = page.evaluate(
        () =>
          new Promise<number[][]>((done) => {
            const out: number[][] = [];
            const t0 = performance.now();
            const tick = () => {
              const el = document.querySelector<HTMLElement>('[data-slot="prompt-input-token-suggestions"]');
              if (el && !el.hidden) {
                const r = el.getBoundingClientRect();
                out.push([r.left + r.width / 2, r.top + r.height / 2]);
              }
              if (performance.now() - t0 < 500) requestAnimationFrame(tick);
              else done(out);
            };
            requestAnimationFrame(tick);
          }),
      );
      await page.keyboard.type("@");
      const boxes = await frames;
      assert.ok(boxes.length > 3, `${open} open: panel shown (${boxes.length} frames)`);
      const [fx, fy] = boxes.at(-1)!;
      const drift = Math.max(...boxes.map(([x, y]) => Math.max(Math.abs(x! - fx!), Math.abs(y! - fy!))));
      assert.ok(drift <= 1, `${open} open: centre drift ${drift.toFixed(1)} px`);
      await page.keyboard.press("Escape");
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(200);
    }
  } finally {
    await page.close();
  }
});
