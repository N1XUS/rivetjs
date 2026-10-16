import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Lightbox: Plugins",
  summary:
    "Every plugin part: zoom buttons, captions and its toggle, a counter, a thumbnails strip and its toggle, slideshow, fullscreen, download and share (hidden where the browser lacks the API), on the blur backdrop.",
  tags: ["lightbox", "zoom", "thumbnails", "captions"],
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
