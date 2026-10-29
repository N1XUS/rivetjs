import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "BarChart: Horizontal stacked bars",
  summary: "Horizontal bars with `stacked`: one bar per category split by series.",
  tags: ["bar-chart", "chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#bar-chart-horizontal-stacked .chart__bar-stack" }, { matches: "#bar-chart-horizontal-stacked [data-slot=chart-slot][aria-label^=Team]" }],
});
