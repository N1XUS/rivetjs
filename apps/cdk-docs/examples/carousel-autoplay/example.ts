import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Autoplay with a rotation control",
  summary:
    "autoplay advances every 3 s (embla Autoplay); hover pauses it, keyboard focus or the rotation control stops it (W3C APG), and the dots pick a slide.",
  tags: ["carousel", "autoplay", "tailwind", "a11y"],
  status: "experimental",
  frame: { height: 240, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#offers", "data-playing", "true"] },
    { attr: ["#offers .rv-CarouselContainer", "aria-live", "off"] },
    { attr: ["#offers-tab-1", "aria-selected", "true"] },
    { name: ["#rotation", "Stop automatic slide show"] },
    { click: "#rotation" },
    { name: ["#rotation", "Start automatic slide show"] },
    { attr: ["#offers", "data-playing", null] },
    { attr: ["#offers .rv-CarouselContainer", "aria-live", "polite"] },
    { click: "#offers-tab-3" },
    { attr: ["#offers-slide-3", "data-snapped", "true"] },
  ],
});
