import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TrendChip: variants",
  summary: "Soft (default), primary, secondary, tertiary and ghost chips for each direction.",
  tags: ["trend-chip"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#tc-variants .trend-chip--primary",
    },
  ],
});
