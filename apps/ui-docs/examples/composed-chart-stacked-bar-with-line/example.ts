import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ComposedChart: Stacked Bar With Line",
  summary: "stacked stacks the bar series; a dashed line marks the target.",
  tags: ["composed-chart"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#composed-chart-stacked-bar-with-line [data-slot=chart-slot]",
    },
  ],
});
