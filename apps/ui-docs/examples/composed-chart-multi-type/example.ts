import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ComposedChart: Multi Type",
  summary: "Bars, an area and a line together.",
  tags: ["composed-chart"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#composed-chart-multi-type [data-slot=chart-slot]",
    },
  ],
});
