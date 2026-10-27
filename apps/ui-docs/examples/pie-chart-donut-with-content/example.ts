import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PieChart: Donut With Content",
  summary: "children fill the centre of a donut, centerLabel goes below.",
  tags: ["pie-chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#pie-chart-donut-with-content .chart__sector",
    },
  ],
});
