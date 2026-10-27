import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ComposedChart: Bar With Area",
  summary: "Bars per month with the trend as an area behind them.",
  tags: ["composed-chart"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#composed-chart-bar-with-area [data-slot=chart-slot]",
    },
  ],
});
