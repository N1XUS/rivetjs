import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Chart: Line",
  summary: "Two lines with a currency formatter on the y axis and tooltips; the linear curve option draws straight segments.",
  tags: ["chart"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#chart-line [data-slot=chart-slot][aria-label^=Jun]" }],
});
