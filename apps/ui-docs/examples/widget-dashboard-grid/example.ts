import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Widget: Dashboard Grid",
  summary: "Several widgets in a responsive grid keep one visual rhythm: a KPI strip, a wide chart and a side donut.",
  tags: ["widget"],
  status: "experimental",
  frame: { height: 640 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#widget-grid", "Open tickets"],
    },
  ],
});
