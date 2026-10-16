import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Chart: Area",
  summary: "Monthly visits by source as a monotone area chart with a legend, axes, grid and hover / focus tooltips (no script).",
  tags: ["chart", "data-display"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#chart-area [data-slot=chart-slot][aria-label^=Jun]" }],
});
