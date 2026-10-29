import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AreaChart: Usage",
  summary: "One series of monthly revenue as a filled monotone area; each month is a focusable slot with its tooltip.",
  tags: ["area-chart", "chart"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#area-chart-basic .chart__area" }, { matches: "#area-chart-basic [data-slot=chart-slot][aria-label^=Jun]" }],
});
