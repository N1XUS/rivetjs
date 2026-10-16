import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kpi: Usage",
  summary: "A KPI card: title with an icon, formatted value, trend chip, a description and a sparkline of the last eight weeks.",
  tags: ["kpi", "data-display"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#kpi-revenue [data-slot=kpi-value]", "$48,210"],
    },
  ],
});
