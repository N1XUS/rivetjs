import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TrendChip: custom indicator",
  summary: "Your own lucide icon replaces the default trend icon.",
  tags: ["trend-chip"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#tc-indicator .trend-chip__indicator",
    },
  ],
});
