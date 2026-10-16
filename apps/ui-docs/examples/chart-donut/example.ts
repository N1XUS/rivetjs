import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Chart: Donut",
  summary: "A donut of traffic share with a centre label and a legend of values and percentages.",
  tags: ["chart"],
  status: "experimental",
  frame: { height: 336, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#chart-donut .chart__donut-segment" }],
});
