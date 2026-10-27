import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Chart: Grouped bars",
  summary: "Three series side by side per category: each team is one focusable slot with every quarter in its tooltip.",
  tags: ["chart"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#chart-bar-grouped [data-slot=chart-slot][aria-label^=Growth]" },
    { matches: "#chart-bar-grouped .chart__bar-group:first-child .chart__bar:nth-child(3)" },
  ],
});
