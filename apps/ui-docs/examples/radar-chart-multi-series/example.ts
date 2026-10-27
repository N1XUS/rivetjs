import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadarChart: Multi Series",
  summary: "Outline shapes (fill: false) keep several series readable.",
  tags: ["radar-chart"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#radar-chart-multi-series .radar-chart__shape",
    },
  ],
});
