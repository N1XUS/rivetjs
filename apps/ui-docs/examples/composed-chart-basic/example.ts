import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ComposedChart: Usage",
  summary: "Each series has a type (bar, line or area); they share the axes, the grid and one tooltip per index.",
  tags: ["composed-chart"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#composed-chart-basic [data-slot=chart-slot]",
    },
  ],
});
