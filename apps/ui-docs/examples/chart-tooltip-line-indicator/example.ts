import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChartTooltip: Line Indicator",
  summary: 'indicator="line" draws a tall narrow pill instead of a dot (line charts).',
  tags: ["chart-tooltip"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: ".chart-tooltip__indicator--line",
    },
  ],
});
