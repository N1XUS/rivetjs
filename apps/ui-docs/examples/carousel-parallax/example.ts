import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Parallax",
  summary: "embla's Parallax example on the ui Carousel: each slide's wider image layer moves against the scroll (dragFree + loop).",
  tags: ["carousel", "tween"],
  status: "experimental",
  frame: { height: 324, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#carousel-parallax", "data-ready", "true"] },
    { matches: '#carousel-parallax-slide-0 .parallax-layer[style*="translateX"]' },
    { click: "#carousel-parallax-next" },
    { attr: ["#carousel-parallax-slide-1", "data-snapped", "true"] },
  ],
});
