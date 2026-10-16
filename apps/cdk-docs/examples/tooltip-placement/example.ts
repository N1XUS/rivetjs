import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tooltip placement",
  summary:
    "Tooltip placement (default top), offset and crossOffset, flipping when there is no room and shouldFlip={false}; data-placement on the Tooltip and the OverlayArrow shows the side used.",
  tags: ["tooltip", "placement", "position"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { key: "Tab" },
    // At the top edge: top flips to bottom.
    { attr: ["#tp-flip", "data-placement", "bottom"] },
    { attr: ["#tp-flip > .rv-OverlayArrow", "data-placement", "bottom"] },
    { key: "Tab" },
    { attr: ["#tp-noflip", "data-placement", "top"] },
    { key: "Tab" },
    { attr: ["#tp-right", "data-placement", "right"] },
    { attr: ["#tp-right > .rv-OverlayArrow", "data-placement", "right"] },
    { key: "Tab" },
    { attr: ["#tp-left", "data-placement", "left"] },
    { key: "Tab" },
    { attr: ["#tp-bottom", "data-placement", "bottom"] },
    { key: "Tab" },
    { attr: ["#tp-end", "data-placement", "right"] },
  ],
});
