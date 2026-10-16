import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Motion: Masonry expand",
  summary:
    "Rivet addition: the Masonry expand demo with `motion={layoutDriver({ type: spring })}`: the cdk FLIP core keeps the pure-geometry relayout, Motion's WAAPI engine plays it with a spring.",
  tags: ["motion", "masonry", "layout"],
  status: "experimental",
  frame: { height: 620 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#masonry-expand", "role", "grid"] },
    { click: '#masonry-expand [data-key="cherries"]' },
    { attr: ['#masonry-expand [data-key="cherries"] [data-expanded]', "data-expanded", "true"] },
  ],
});
