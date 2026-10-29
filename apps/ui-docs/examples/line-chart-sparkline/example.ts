import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "LineChart: Sparkline",
  summary: "Line sparklines in metric cards: line charts with every part off but the line, sized to their box.",
  tags: ["line-chart", "chart"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#line-chart-sparkline .chart--line" }],
});
