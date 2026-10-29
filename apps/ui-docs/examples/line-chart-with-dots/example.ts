import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "LineChart: With Dots",
  summary: "`showDots`: a dot on every data point, not only on hover.",
  tags: ["line-chart", "chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#line-chart-with-dots .chart__point" }, { matches: "#line-chart-with-dots [data-slot=chart-slot][aria-label^=W4]" }],
});
