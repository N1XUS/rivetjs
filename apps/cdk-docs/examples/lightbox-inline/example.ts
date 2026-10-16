import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Inline lightbox in the page",
  summary: "LightboxInline renders the same carousel in the page, without an overlay: swipe, drag or use the buttons; the counter and captions follow.",
  tags: ["lightbox", "tailwind", "inline"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["[data-lightbox-counter]", "1 / 4"] },
    { attr: ["[data-action=prev]", "disabled", ""] },
    { click: "[data-action=next]" },
    { expect: ["[data-lightbox-counter]", "2 / 4"] },
  ],
});
