import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Auto height",
  summary: "embla's Auto Height example on the ui Carousel: the AutoHeight plugin (@rivetjs/cdk/carousel/auto-height) resizes the track per snap.",
  tags: ["carousel", "plugin"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#carousel-auto-height", "data-ready", "true"] },
    { matches: '#carousel-auto-height-viewport > div[style*="height: 160px"]' },
    { click: "#carousel-auto-height-next" },
    { matches: '#carousel-auto-height-viewport > div[style*="height: 224px"]' },
  ],
});
