import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtual scroll: appendOnly",
  summary: "appendOnly keeps rows in the DOM once rendered: scrolling only adds rows, the range always starts at 0 and the content is never translated.",
  tags: ["scrolling", "virtual scroll"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { absent: '#append .row[data-index="40"]' },
    { press: ["#append", "PageDown"] },
    { press: ["#append", "PageDown"] },
    { press: ["#append", "PageDown"] },
    { press: ["#append", "PageDown"] },
    { press: ["#append", "PageDown"] },
    { matches: '#append .row[data-index="30"]' },
    // Earlier rows stay rendered.
    { matches: '#append .row[data-index="0"]' },
    { matches: '#append .cdk-virtual-scroll-content-wrapper[style*="translateY(0px)"]' },
    { expect: ["#append-count", "rendered from 0"] },
  ],
});
