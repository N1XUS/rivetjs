import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Lightbox: Inline",
  summary:
    "LightboxInline renders the same carousel in the page (no overlay): server-rendered, swipe / buttons / keys move between photos, a finite carousel disables the arrows at its ends.",
  tags: ["lightbox", "inline", "carousel"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["[data-lightbox-counter]", "1 / 4"] },
    { attr: ["[data-action=prev]", "disabled", ""] },
    { click: "[data-action=next]" },
    { expect: ["[data-lightbox-counter]", "2 / 4"] },
  ],
});
