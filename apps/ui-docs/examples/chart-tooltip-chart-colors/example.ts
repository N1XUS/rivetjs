import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChartTooltip: Chart Colors",
  summary: "Indicator colors take any CSS color; the chart palette is var(--chart-1) \u2026 var(--chart-6).",
  tags: ["chart-tooltip"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: ".chart-tooltip__indicator--dot",
    },
  ],
});
