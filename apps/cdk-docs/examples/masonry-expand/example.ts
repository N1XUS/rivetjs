import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Masonry: click to expand",
  summary:
    "`getSpan` returns an accessor, so a span is a live item control: a click (or Enter) on a card makes it span two columns, a second click shrinks it. One incremental relayout, the neighbours slide on the house motion (reduced motion jumps). Works on the resumed page: the click is the first code that runs.",
  tags: ["masonry", "motion", "image", "tailwind"],
  status: "experimental",
  frame: { height: 600 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#cards", "role", "grid"] },
    { click: '#cards [data-key="cherries-0"]' },
    { attr: ['#cards [data-key="cherries-0"] [data-expanded]', "data-expanded", "true"] },
    { click: '#cards [data-key="cherries-0"]' },
    { attr: ['#cards [data-key="cherries-0"] [data-expanded]', "data-expanded", "false"] },
  ],
});
