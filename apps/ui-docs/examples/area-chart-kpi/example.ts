import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AreaChart: KPI With Area Chart",
  summary: "A Kpi card whose chart part holds an axis-free area chart that keeps its focusable tooltips.",
  tags: ["area-chart", "chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#area-chart-kpi .chart--area" }, { matches: "#area-chart-kpi [data-slot=chart-slot][aria-label^=Sun]" }],
});
