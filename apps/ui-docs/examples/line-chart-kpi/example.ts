import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "LineChart: KPI With Chart",
  summary: "A Kpi card with an axis-free line chart in its chart part; the points keep their focusable tooltips.",
  tags: ["line-chart", "chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#line-chart-kpi .chart--line" }, { matches: "#line-chart-kpi [data-slot=chart-slot][aria-label^=Jun]" }],
});
