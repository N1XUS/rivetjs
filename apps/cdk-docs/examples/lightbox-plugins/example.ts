import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Lightbox with zoom, captions, counter, thumbnails and toolbar plugins",
  summary:
    "Every plugin is its own subpath: Zoom (wheel, pinch, double click, buttons), Captions with a toggle, Counter, Thumbnails, Slideshow, Fullscreen, Download and Share buttons.",
  tags: ["lightbox", "tailwind", "plugins", "zoom"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#thumb-0" },
    { expect: ["[data-lightbox-counter]", "1 / 4"] },
    { expect: ["[data-lightbox-captions]", "Robot"] },
    { click: "[data-lightbox-thumbnail][data-index='2']" },
    { expect: ["[data-lightbox-counter]", "3 / 4"] },
    { click: "[data-action=captions]" },
    { absent: "[data-lightbox-captions]" },
    { click: "[data-action=zoom-in]" },
    { matches: "[data-lightbox-container][data-zoomed]" },
  ],
});
