import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Showcase: Dashboard",
  summary:
    "A store analytics dashboard: a period switch that redraws KPIs with sparklines, a revenue area chart against the previous period, a channel donut, and a searchable, filterable, sortable orders grid.",
  tags: ["showcase", "kpi", "chart", "data-grid", "segment", "search-field"],
  status: "experimental",
  frame: { height: 900 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#kpi-revenue [data-slot=kpi-value]", "$48,210"] },
    { click: "#period [role=radio]:first-child" },
    { expect: ["#kpi-revenue [data-slot=kpi-value]", "$11,940"] },
    { fill: ["#order-search", "Okafor"] },
    { expect: ["#orders tbody", "Ada Okafor"] },
    { absent: "#orders tbody tr[data-key='1042']" },
  ],
});
