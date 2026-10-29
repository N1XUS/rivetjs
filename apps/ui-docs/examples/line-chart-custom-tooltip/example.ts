import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "LineChart: With Custom Tooltip",
  summary: "`tooltip` returns a ChartTooltip per hour: line indicators, p50 / p95 latency and whether the hour met its target.",
  tags: ["line-chart", "chart"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#line-chart-custom-tooltip .chart__tooltip--custom [data-slot=chart-tooltip-item]" },
    { matches: "#line-chart-custom-tooltip [data-slot=chart-slot][aria-label^='12:00']" },
  ],
});
