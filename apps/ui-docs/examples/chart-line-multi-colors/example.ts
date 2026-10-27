import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Chart: Line colors",
  summary: "Three series with their own colours (any CSS colour or a `--chart-N` token) and a tooltip listing each.",
  tags: ["chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#chart-line-multi-colors .chart__legend-item" }, { matches: '#chart-line-multi-colors [data-slot=chart-slot][aria-label^="12:00"]' }],
});
