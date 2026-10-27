import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Widget: With Pie Chart",
  summary: "A donut chart with its legend in a widget.",
  tags: ["widget"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#widget-pie .chart__donut-segment",
    },
  ],
});
