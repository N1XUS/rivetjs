import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PieChart: With Breakdown",
  summary: 'legend="breakdown" lists every segment with its value and share.',
  tags: ["pie-chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#pie-chart-with-breakdown .chart__sector",
    },
  ],
});
