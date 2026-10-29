import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "BarChart: Custom Tooltip",
  summary: "`tooltip` returns a ChartTooltip per category: a header, dot indicators and the share of the plan used.",
  tags: ["bar-chart", "chart"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#bar-chart-custom-tooltip .chart__tooltip--custom [data-slot=chart-tooltip-item]" },
    { matches: "#bar-chart-custom-tooltip [data-slot=chart-slot][aria-label^=Jun]" },
  ],
});
