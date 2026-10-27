import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "KpiGroup: With From Suffix",
  summary: 'Each KPI shows its previous value as a muted "from" suffix next to the current one, formatted the same way with NumberValue.',
  tags: ["kpi-group"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#kpi-group-from .kpi:first-child [data-slot=number-value-value]", "18,400"],
    },
  ],
});
