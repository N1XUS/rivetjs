import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "KpiGroup: Usage",
  summary: "Three KPI cards on one shared surface, divided by separators; the cards share the width and wrap on narrow screens.",
  tags: ["kpi-group"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#kpi-group [data-slot=kpi-group-separator]",
    },
    {
      expect: ["#kpi-group .kpi:first-child [data-slot=kpi-value]", "$48,210"],
    },
  ],
});
