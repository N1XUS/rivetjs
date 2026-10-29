import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AreaChart: Sparkline",
  summary: "Sparklines in a list of metrics: area charts without axes, grid, legend or tooltip, sized to their box.",
  tags: ["area-chart", "chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#area-chart-sparkline .chart--sparkline" }],
});
