import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Lightbox: Basic",
  summary:
    "A thumbnail grid opens the Lightbox at the clicked photo; arrows, swipe or the keyboard move between photos, Escape closes it and focus returns to the thumbnail.",
  tags: ["lightbox", "images", "modal"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#thumb-1" },
    { matches: "[role=dialog]" },
    { attr: ["[data-lightbox-slide][data-current] img", "alt", "Avocado half on pink"] },
    { click: "[data-action=next]" },
    { attr: ["[data-lightbox-slide][data-current] img", "alt", "Two cherries on mint"] },
    { key: "Escape" },
    { absent: "[role=dialog]" },
    { focused: "#thumb-1" },
  ],
});
