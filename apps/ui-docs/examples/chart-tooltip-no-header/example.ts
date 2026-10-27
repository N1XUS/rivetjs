import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChartTooltip: No Header",
  summary: "Leave out the header (or pass hideHeader to ChartTooltip.Content) for a compact card.",
  tags: ["chart-tooltip"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      absent: ".chart-tooltip__header",
    },
  ],
});
