import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ComposedChart: Area With Line",
  summary: "An area for the volume, a line for the goal.",
  tags: ["composed-chart"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#composed-chart-area-with-line [data-slot=chart-slot]",
    },
  ],
});
