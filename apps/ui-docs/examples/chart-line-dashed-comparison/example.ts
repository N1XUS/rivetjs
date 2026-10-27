import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Chart: Dashed comparison",
  summary: "A series with `dashed` draws its line dashed: last year against this year.",
  tags: ["chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#chart-line-dashed-comparison .chart__line[data-dashed]" }],
});
