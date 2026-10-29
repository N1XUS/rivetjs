import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "LineChart: Usage",
  summary: "Two lines with a currency formatter on the y axis and tooltips; the linear curve option draws straight segments.",
  tags: ["line-chart", "chart"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#line-chart-basic [data-slot=chart-slot][aria-label^=Jun]" }],
});
