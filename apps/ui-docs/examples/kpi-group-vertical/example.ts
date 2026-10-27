import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "KpiGroup: Vertical",
  summary: "A vertical KPI group stacks the cards with horizontal separators, e.g. for a dashboard side column.",
  tags: ["kpi-group"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#kpi-group-vertical[data-orientation=vertical]",
    },
  ],
});
