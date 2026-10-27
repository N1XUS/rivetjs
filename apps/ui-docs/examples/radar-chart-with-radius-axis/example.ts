import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadarChart: With Radius Axis",
  summary: "showRadiusAxis writes the tick values along the first spoke; maxValue fixes the scale.",
  tags: ["radar-chart"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#radar-chart-with-radius-axis .radar-chart__shape",
    },
  ],
});
