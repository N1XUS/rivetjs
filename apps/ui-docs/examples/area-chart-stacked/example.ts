import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AreaChart: Stacked",
  summary: "`stacked` stacks the areas: storage used per file type, the top edge is the total.",
  tags: ["area-chart", "chart"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#area-chart-stacked [data-slot=chart-slot][aria-label^=Jun]" }],
});
