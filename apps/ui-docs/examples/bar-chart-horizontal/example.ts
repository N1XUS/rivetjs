import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "BarChart: Horizontal bars",
  summary: '`orientation="horizontal"`: categories down the side, bars grow along the inline axis (mirrored in RTL).',
  tags: ["bar-chart", "chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#bar-chart-horizontal[data-orientation=horizontal]" },
    { matches: "#bar-chart-horizontal .chart__y-label" },
    { matches: "#bar-chart-horizontal [data-slot=chart-slot][aria-label^=Safari]" },
  ],
});
