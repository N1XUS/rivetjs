import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "BarChart: KPI With Bar Chart",
  summary: "A Kpi card with a compact bar chart of daily values in its chart part.",
  tags: ["bar-chart", "chart"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#bar-chart-kpi .chart--bar" }, { matches: "#bar-chart-kpi [data-slot=chart-slot][aria-label^=Sun]" }],
});
