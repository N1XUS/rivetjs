import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PieChart: Custom Tooltip",
  summary: "tooltip renders your own content per sector, for example a ChartTooltip.",
  tags: ["pie-chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#pie-chart-custom-tooltip .chart__sector",
    },
  ],
});
