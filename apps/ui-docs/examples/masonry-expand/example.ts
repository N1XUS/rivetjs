import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Masonry: Expand",
  summary:
    "Rivet addition: click (or Enter) a card to span two columns, click again to shrink. `getSpan` returns an accessor (a live item control): one incremental relayout, neighbours slide on the house motion; reduced motion jumps. Works on the resumed page.",
  tags: ["masonry", "motion", "image"],
  status: "experimental",
  frame: { height: 620 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#masonry-expand", "role", "grid"] },
    { click: '#masonry-expand [data-key="cherries"]' },
    { attr: ['#masonry-expand [data-key="cherries"] [data-expanded]', "data-expanded", "true"] },
  ],
});
