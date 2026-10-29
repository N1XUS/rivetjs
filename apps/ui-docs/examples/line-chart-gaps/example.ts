import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "LineChart: Missing Values",
  summary: "A missing value leaves a gap in the line; `connectNulls` draws across it. Tooltips list only the series with a value.",
  tags: ["line-chart", "chart"],
  status: "experimental",
  frame: { height: 600 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: '#line-chart-gaps [data-slot=chart-slot][aria-label="Wed: Outdoor 14.8 °C"]' },
    { matches: "#line-chart-gaps-joined [data-slot=chart-slot][aria-label^=Sat]" },
  ],
});
