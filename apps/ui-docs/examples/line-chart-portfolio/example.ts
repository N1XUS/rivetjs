import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "LineChart: Portfolio",
  summary: "A portfolio card: total value and change, the value against a dashed benchmark, and the allocation below.",
  tags: ["line-chart", "chart"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#line-chart-portfolio .chart__line[data-dashed]" }, { matches: "#line-chart-portfolio [data-slot=chart-slot][aria-label^=Dec]" }],
});
