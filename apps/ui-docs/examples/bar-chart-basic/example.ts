import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "BarChart: Usage",
  summary: "One series of weekly orders as vertical bars with a y axis, grid and hover / focus tooltips (no script).",
  tags: ["bar-chart", "chart"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#bar-chart-basic .chart__bar" }, { matches: "#bar-chart-basic [data-slot=chart-slot][aria-label^=Fri]" }],
});
