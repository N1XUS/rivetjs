import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TrendChip: tabular numbers",
  summary: "Chips use tabular numerals, so values line up in a column.",
  tags: ["trend-chip"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#tc-tabular li .trend-chip",
    },
  ],
});
