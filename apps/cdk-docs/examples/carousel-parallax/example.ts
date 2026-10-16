import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel parallax tween",
  summary: "embla's Parallax example: each slide's wider inner layer moves against the scroll (dragFree + loop), driven by onApi scroll events.",
  tags: ["carousel", "tween", "tailwind"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#parallax", "data-ready", "true"] },
    { matches: '#parallax-slide-0 .parallax-layer[style*="translateX"]' },
    { click: "#next" },
    { attr: ["#parallax-slide-1", "data-snapped", "true"] },
  ],
});
