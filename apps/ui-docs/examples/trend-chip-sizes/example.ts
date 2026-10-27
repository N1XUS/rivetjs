import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TrendChip: sizes",
  summary: "Small, medium and large chips.",
  tags: ["trend-chip"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#tc-sizes .trend-chip--lg",
    },
  ],
});
