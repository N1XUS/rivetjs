import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Widget: With Bar Chart",
  summary: "A stacked bar chart in a widget; the legend lives in the header so the chart drops its own.",
  tags: ["widget"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#widget-bar .chart__bar",
    },
  ],
});
