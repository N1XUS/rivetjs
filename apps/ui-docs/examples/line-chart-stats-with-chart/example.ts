import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "LineChart: Stats With Chart",
  summary: "A card with three stats and their trends above a two-series line chart of the same period.",
  tags: ["line-chart", "chart"],
  status: "experimental",
  frame: { height: 440 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#line-chart-stats-with-chart .chart--line" }, { matches: "#line-chart-stats-with-chart [data-slot=chart-slot][aria-label^=Sun]" }],
});
