import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PieChart: Donut With Label",
  summary: "Without children the centre shows the formatted total above centerLabel.",
  tags: ["pie-chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#pie-chart-donut-with-label .chart__sector",
    },
  ],
});
