import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kpi: With Chart Tooltip",
  summary: "An area chart without axes at the bottom of the card; hovering or focusing a day shows a ChartTooltip with its value.",
  tags: ["kpi"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#kpi-chart-tooltip .kpi__chart svg",
    },
    {
      matches: "#kpi-chart-tooltip .chart-tooltip__value",
    },
  ],
});
