import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "BarChart: Comparison",
  summary: "This year against last year per quarter: the previous period in a muted colour beside the current one.",
  tags: ["bar-chart", "chart"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#bar-chart-comparison .chart__bar-group" }, { matches: "#bar-chart-comparison [data-slot=chart-slot][aria-label^=Q4]" }],
});
