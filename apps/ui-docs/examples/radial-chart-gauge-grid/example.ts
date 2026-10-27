import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadialChart: Gauge Grid",
  summary: "Several small gauges in a grid, one metric each.",
  tags: ["radial-chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#radial-chart-gauge-grid .chart__sector-path",
    },
  ],
});
