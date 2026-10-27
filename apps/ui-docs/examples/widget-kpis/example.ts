import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Widget: With KPIs",
  summary: "Combine Widget with KpiGroup for a metrics overview with inline sparklines.",
  tags: ["widget"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#widget-kpis", "$31,240"],
    },
  ],
});
