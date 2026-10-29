import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "LineChart: Multi Line Chart Colors",
  summary: "Three series with their own colours (any CSS colour or a `--chart-N` token) and a tooltip listing each.",
  tags: ["line-chart", "chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#line-chart-multi-colors .chart__legend-item" }, { matches: '#line-chart-multi-colors [data-slot=chart-slot][aria-label^="12:00"]' }],
});
