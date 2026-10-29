import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "BarChart: Grouped bars",
  summary: "Three series side by side per category: each team is one focusable slot with every quarter in its tooltip.",
  tags: ["bar-chart", "chart"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#bar-chart-grouped [data-slot=chart-slot][aria-label^=Growth]" },
    { matches: "#bar-chart-grouped .chart__bar-group:first-child .chart__bar:nth-child(3)" },
  ],
});
