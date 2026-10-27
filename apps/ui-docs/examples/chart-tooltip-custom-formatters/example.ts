import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChartTooltip: Custom Formatters",
  summary: "labelFormatter and valueFormatter on ChartTooltip.Content format the header and every value.",
  tags: ["chart-tooltip"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#ct-format .chart-tooltip__header",
    },
  ],
});
