import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Showcase: Finance",
  summary:
    "A personal finance overview: net worth with a range switch, account balances, a month switch that redraws income / spending KPIs, cash flow, a category donut and budget meters, upcoming bills, and a searchable, filterable, sortable transactions grid.",
  tags: ["showcase", "kpi", "chart", "data-grid", "number-value", "trend-chip", "meter", "item-card-group", "segment", "search-field", "widget"],
  status: "experimental",
  frame: { height: 960 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#net-worth-value", "$73,226.28"] },
    { expect: ["#net-worth-trend", "14.2%"] },
    { expect: ["#kpi-spending [data-slot=kpi-value]", "$4,182"] },
    { expect: ["#tx-count", "9 of 9 transactions in October"] },
    { click: "#range [role=radio]:first-child" },
    { expect: ["#net-worth-trend", "7.8%"] },
    { click: "#month [role=radio]:first-child" },
    { expect: ["#kpi-spending [data-slot=kpi-value]", "$4,612"] },
    { expect: ["#tx-grid tbody", "Coastline Hotels"] },
    { expect: ["#tx-count", "8 of 8 transactions in August"] },
    { fill: ["#tx-search", "Osteria"] },
    { expect: ["#tx-grid tbody", "Osteria Lume"] },
    { absent: "#tx-grid tbody tr[data-key='t-aug-7']" },
    { expect: ["#tx-count", "1 of 8 transactions in August"] },
  ],
});
