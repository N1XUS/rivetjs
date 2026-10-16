import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Auto scroll",
  summary:
    "embla's Auto Scroll example on the ui Carousel: autoScroll scrolls continuously once started (loop, 45% slides); the rotation control starts and stops it.",
  tags: ["carousel", "autoplay"],
  status: "experimental",
  frame: { height: 308, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#carousel-auto-scroll", "data-ready", "true"] },
    { name: ["#carousel-auto-scroll-play", "Start auto scroll"] },
    { click: "#carousel-auto-scroll-play" },
    { name: ["#carousel-auto-scroll-play", "Stop auto scroll"] },
    { attr: ["#carousel-auto-scroll-play", "data-rotating", "true"] },
    { click: "#carousel-auto-scroll-play" },
    { name: ["#carousel-auto-scroll-play", "Start auto scroll"] },
  ],
});
