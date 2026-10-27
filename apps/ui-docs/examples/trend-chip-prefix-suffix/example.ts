import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TrendChip: prefix and suffix",
  summary: "Text before and after the value: a sign and a comparison period.",
  tags: ["trend-chip"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#tc-affix .trend-chip__suffix",
    },
  ],
});
