import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Lightbox opened from a thumbnail grid",
  summary:
    "Four thumbnails open a modal Lightbox at the clicked photo; swipe, drag, arrow keys or the buttons move between photos, Escape or the close button closes it and focus returns to the thumbnail.",
  tags: ["lightbox", "tailwind", "modal", "images"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#thumb-1" },
    { matches: "[role=dialog]" },
    { attr: ["[data-lightbox-slide][data-current] img", "alt", "Avocado half on pink"] },
    { key: "ArrowRight" },
    { attr: ["[data-lightbox-slide][data-current] img", "alt", "Two cherries on mint"] },
    { key: "Escape" },
    { absent: "[role=dialog]" },
    { focused: "#thumb-1" },
  ],
});
