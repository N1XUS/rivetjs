import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChartTooltip: Inactive",
  summary: "active={false} renders nothing (for a tooltip you show or hide yourself).",
  tags: ["chart-tooltip"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#ct-inactive",
    },
    {
      absent: ".chart-tooltip",
    },
  ],
});
