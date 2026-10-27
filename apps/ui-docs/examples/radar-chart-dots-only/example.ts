import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadarChart: Dots Only",
  summary: "fill: false and stroke: false with dots: true leaves only the vertices.",
  tags: ["radar-chart"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#radar-chart-dots-only .radar-chart__shape",
    },
  ],
});
