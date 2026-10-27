import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadialChart: With Legend",
  summary: "showLegend lists every ring with its value.",
  tags: ["radial-chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#radial-chart-with-legend .chart__sector-path",
    },
  ],
});
