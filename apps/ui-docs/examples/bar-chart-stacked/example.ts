import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "BarChart: Stacked",
  summary: "`stacked` stacks the series in one bar per month; each month is a focusable slot with its tooltip.",
  tags: ["bar-chart", "chart"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#bar-chart-stacked .chart__bar-stack" }, { matches: "#bar-chart-stacked [data-slot=chart-slot][aria-label^=Jun]" }],
});
