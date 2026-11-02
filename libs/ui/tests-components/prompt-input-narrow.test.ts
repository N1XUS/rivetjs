// PromptInput at phone width (`/prompt-input-narrow`, production story build; user report 2026-11-01): below a 30rem
// composer the toolbar wraps (actions on their own right-aligned row) and nothing leaves the rounded shell, the checkbox
// label stays on one line; queue rows keep the content on one line with the description under it. At 1280 px the toolbar
// stays one row and the description sits beside the content (unchanged layout).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

type Box = { left: number; right: number; top: number; bottom: number; height: number };

async function measure(width: number) {
  const page = await s.browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.goto(s.origin + "/prompt-input-narrow", { waitUntil: "networkidle" });
    return await page.evaluate(() => {
      const box = (el: Element): Box => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height };
      };
      const q = (sel: string) => document.querySelector(sel)!;
      const shell = q("#pn-review .prompt-input__shell");
      const parts = [...shell.querySelectorAll(".prompt-input__toolbar-start > *, .prompt-input__toolbar-end > *")];
      const label = q("#pn-commit-label");
      const lineHeight = parseFloat(getComputedStyle(label).lineHeight);
      const item = q("#pn-queue .prompt-input__queue-item");
      return {
        shell: box(shell),
        parts: parts.map(box),
        page: document.documentElement.scrollWidth,
        label: { lines: Math.round(box(label).height / lineHeight) },
        item: box(item),
        itemParts: [...item.children].map(box),
        content: box(item.querySelector(".prompt-input__queue-item-content")!),
        description: box(item.querySelector(".prompt-input__queue-item-description")!),
        contentLineHeight: parseFloat(getComputedStyle(item.querySelector(".prompt-input__queue-item-content")!).lineHeight),
        actions: box(item.querySelector(".prompt-input__queue-item-actions")!),
      };
    });
  } finally {
    await page.close();
  }
}

const inside = (inner: Box, outer: Box) =>
  inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5 && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5;

test("prompt input narrow: toolbar wraps inside the shell, label one line, queue content one line above its description", async () => {
  for (const width of [320, 375, 390]) {
    const m = await measure(width);
    assert.ok(m.page <= width, `@${width}: page scrolls sideways (${m.page})`);
    m.parts.forEach((part, i) => assert.ok(inside(part, m.shell), `@${width}: toolbar part ${i} ${JSON.stringify(part)} outside ${JSON.stringify(m.shell)}`));
    assert.equal(m.label.lines, 1, `@${width}: checkbox label lines`);
    m.itemParts.forEach((part, i) => assert.ok(inside(part, m.item), `@${width}: queue row part ${i} outside the row`));
    assert.ok(m.content.height <= m.contentLineHeight + 0.5, `@${width}: queue content ${m.content.height}px tall`);
    assert.ok(m.description.top >= m.content.bottom - 0.5, `@${width}: description beside the content`);
  }
});

test("prompt input wide: one-row toolbar, description beside the content", async () => {
  const m = await measure(1280);
  const centres = m.parts.map((p) => (p.top + p.bottom) / 2);
  assert.ok(Math.max(...centres) - Math.min(...centres) <= 1, `toolbar rows: ${centres.join(", ")}`);
  assert.ok(Math.abs((m.description.top + m.description.bottom) / 2 - (m.content.top + m.content.bottom) / 2) <= 2, `description beside content ${JSON.stringify([m.content, m.description, m.item])}`);
});
