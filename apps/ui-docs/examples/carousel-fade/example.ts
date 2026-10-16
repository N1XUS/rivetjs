import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Fade",
  summary: "embla's Fade example on the ui Carousel: the Fade plugin (@rivetjs/cdk/carousel/fade) stacks the photos and cross-fades between them.",
  tags: ["carousel", "plugin"],
  status: "experimental",
  frame: { height: 324, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#carousel-fade", "data-ready", "true"] },
    { matches: '#carousel-fade-slide-0[style*="opacity: 1"]' },
    { matches: '#carousel-fade-slide-1[style*="opacity: 0"]' },
    { click: "#carousel-fade-next" },
    { matches: '#carousel-fade-slide-1[style*="opacity: 1"]' },
  ],
});
