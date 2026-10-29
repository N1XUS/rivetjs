import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "LineChart: Dashed Comparison",
  summary: "A series with `dashed` draws its line dashed: last year against this year.",
  tags: ["line-chart", "chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#line-chart-dashed-comparison .chart__line[data-dashed]" }],
});
