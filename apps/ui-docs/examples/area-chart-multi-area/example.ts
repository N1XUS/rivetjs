import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AreaChart: Multi Area",
  summary: "Monthly visits by source as three overlapping monotone areas with a legend, axes, grid and hover / focus tooltips (no script).",
  tags: ["area-chart", "chart", "data-display"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#area-chart-multi-area [data-slot=chart-slot][aria-label^=Jun]" }],
});
