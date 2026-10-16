import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtual scroll: rendered range and data changes",
  summary: "onRenderedRangeChange reports each new rendered range [start, end); the items signal can grow or shrink and the spacer and range follow.",
  tags: ["scrolling", "virtual scroll", "events", "signals"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#range-state", "range 0–11 of 1000"] },
    { press: ["#range", "End"] },
    { expect: ["#range-log", "–1000"] },
    { expect: ["#range-state", "of 1000"] },
    { click: "#range-shrink" },
    { matches: '#range .cdk-virtual-scroll-spacer[style*="height: 800px"]' },
    { expect: ["#range-state", "of 20"] },
    { expect: ["#range-log", "–20"] },
    { matches: '#range .row[data-index="19"]' },
    { click: "#range-grow" },
    { matches: '#range .cdk-virtual-scroll-spacer[style*="height: 80000px"]' },
    { expect: ["#range-state", "of 2000"] },
  ],
});
