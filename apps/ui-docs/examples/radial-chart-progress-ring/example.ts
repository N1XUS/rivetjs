import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadialChart: Progress Ring",
  summary: "A single full ring with a track is a progress ring.",
  tags: ["radial-chart"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#radial-chart-progress-ring .chart__sector-path",
    },
  ],
});
