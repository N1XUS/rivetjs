import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PieChart: Usage",
  summary: "data of { label, value } draws one sector per entry; hover or focus a sector for its tooltip.",
  tags: ["pie-chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#pie-chart-basic .chart__sector",
    },
  ],
});
