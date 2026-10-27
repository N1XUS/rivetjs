import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadarChart: Usage",
  summary: "data + index + series like the cartesian charts: one spoke per datum, one shape per series. Hover a spoke for its values.",
  tags: ["radar-chart"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#radar-chart-basic .radar-chart__shape",
    },
  ],
});
