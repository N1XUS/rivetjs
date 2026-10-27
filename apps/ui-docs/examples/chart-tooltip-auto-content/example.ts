import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChartTooltip: Auto Content",
  summary: "Pass a chart's tooltip render function a ChartTooltip.Content: it lays out the hovered point's label and series. Hover or focus a bar.",
  tags: ["chart-tooltip"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#ct-auto .chart__tooltip--custom .chart-tooltip",
    },
  ],
});
