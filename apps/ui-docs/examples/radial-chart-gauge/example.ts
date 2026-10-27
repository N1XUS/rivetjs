import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadialChart: Gauge",
  summary: "startAngle 210 and endAngle -30 draw an open gauge; children show the value in the centre.",
  tags: ["radial-chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#radial-chart-gauge .chart__sector-path",
    },
  ],
});
