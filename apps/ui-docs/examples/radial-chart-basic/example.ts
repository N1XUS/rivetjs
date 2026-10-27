import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadialChart: Usage",
  summary: "One ring per entry, from the outside in; a ring's sweep is its share of maxValue (100). Hover a ring for its value.",
  tags: ["radial-chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#radial-chart-basic .chart__sector-path",
    },
  ],
});
