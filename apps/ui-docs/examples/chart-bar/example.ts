import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Chart: Bar",
  summary: "Grouped and stacked bar charts over the same data; each month is a focusable slot with its tooltip.",
  tags: ["chart"],
  status: "experimental",
  frame: { height: 620 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#chart-bar-stacked .chart__bar-stack" }, { matches: "#chart-bar [data-slot=chart-slot][aria-label^=Jun]" }],
});
