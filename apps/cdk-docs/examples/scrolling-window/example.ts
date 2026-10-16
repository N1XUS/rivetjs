import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtual scroll: window scrolling",
  summary:
    'scrollable: "window" (Angular scrollWindow) virtualizes against the page scroll: the viewport is as tall as its content and the document scrollbar drives the range.',
  tags: ["scrolling", "virtual scroll", "window"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: '#page-list .row[data-index="0"]' },
    { absent: '#page-list .row[data-index="100"]' },
    { click: "#page-jump" },
    { matches: '#page-list .row[data-index="100"]' },
    { absent: '#page-list .row[data-index="0"]' },
  ],
});
