import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PieChart: Donut",
  summary: "innerRadius (a share of the radius) cuts a hole; paddingAngle separates the sectors.",
  tags: ["pie-chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#pie-chart-donut .chart__sector",
    },
  ],
});
