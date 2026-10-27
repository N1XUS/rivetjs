import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadarChart: Comparison",
  summary: "Two filled series on one grid compare profiles; the legend appears with more than one series.",
  tags: ["radar-chart"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#radar-chart-comparison .radar-chart__shape",
    },
  ],
});
