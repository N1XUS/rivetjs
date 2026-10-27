import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PieChart: Nested Donut",
  summary: "rings stacks donuts from the outside in, one per data set (this year outside, last year inside).",
  tags: ["pie-chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#pie-chart-nested-donut .chart__sector",
    },
  ],
});
