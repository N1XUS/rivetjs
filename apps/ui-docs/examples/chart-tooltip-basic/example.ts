import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChartTooltip: Usage",
  summary: "A tooltip card: a header, then one row per series with an indicator, a label and a value.",
  tags: ["chart-tooltip"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#ct-basic .chart-tooltip__item",
    },
  ],
});
