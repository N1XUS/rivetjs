import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Chart: Horizontal stacked bars",
  summary: "Horizontal bars with `stacked`: one bar per category split by series.",
  tags: ["chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#chart-bar-horizontal-stacked .chart__bar-stack" }, { matches: "#chart-bar-horizontal-stacked [data-slot=chart-slot][aria-label^=Team]" }],
});
