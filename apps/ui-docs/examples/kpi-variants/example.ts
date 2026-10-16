import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kpi: Variants",
  summary: "A row of KPIs in the default, secondary and transparent variants; churn uses an inverted trend.",
  tags: ["kpi"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["[data-slot=kpi-value]", "12,840"] }],
});
