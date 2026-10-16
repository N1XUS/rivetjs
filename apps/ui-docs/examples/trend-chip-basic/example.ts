import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TrendChip: Usage",
  summary: "Up, down and neutral changes; inverted metrics (churn, latency) read green when they fall; soft and ghost variants, two sizes.",
  tags: ["trend-chip", "data-display"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#trend-up[data-trend=up]",
    },
    {
      matches: "#trend-churn[data-trend=down]",
    },
  ],
});
