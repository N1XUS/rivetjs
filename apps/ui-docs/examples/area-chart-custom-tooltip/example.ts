import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AreaChart: Custom Tooltip",
  summary: "`tooltip` returns a ChartTooltip per month: line indicators, the series values and a total row.",
  tags: ["area-chart", "chart"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#area-chart-custom-tooltip .chart__tooltip--custom [data-slot=chart-tooltip-item]" },
    { matches: "#area-chart-custom-tooltip [data-slot=chart-slot][aria-label^=Jun]" },
  ],
});
