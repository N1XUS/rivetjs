import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Chart: Horizontal bars",
  summary: '`orientation="horizontal"`: categories down the side, bars grow along the inline axis (mirrored in RTL).',
  tags: ["chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#chart-bar-horizontal[data-orientation=horizontal]" },
    { matches: "#chart-bar-horizontal .chart__y-label" },
    { matches: "#chart-bar-horizontal [data-slot=chart-slot][aria-label^=Safari]" },
  ],
});
