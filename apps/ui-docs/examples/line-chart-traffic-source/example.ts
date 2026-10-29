import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "LineChart: Traffic Source",
  summary: "Weekly sessions per traffic source as four lines, with a legend list of totals and shares.",
  tags: ["line-chart", "chart"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "#line-chart-traffic-source [data-slot=chart-slot][aria-label^=W8]" }, { matches: "#line-chart-traffic-source li" }],
});
