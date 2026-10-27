import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Widget: Usage Summary",
  summary: "No chart: structured usage rows with ProgressCircle indicators inside a widget.",
  tags: ["widget"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#widget-usage", "Build minutes"],
    },
  ],
});
