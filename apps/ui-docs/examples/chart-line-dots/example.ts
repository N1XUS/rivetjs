import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Chart: Line with dots",
  summary: "`showDots`: a dot on every data point, not only on hover.",
  tags: ["chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#chart-line-dots .chart__point" }, { matches: "#chart-line-dots [data-slot=chart-slot][aria-label^=W4]" }],
});
