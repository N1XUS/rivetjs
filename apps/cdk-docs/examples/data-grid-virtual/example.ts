import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: virtualized",
  summary: "100 000 rows: only the rows in view are rendered (fixed row height), sorting included.",
  tags: ["data-grid", "virtualization", "css"],
  status: "experimental",
  frame: { height: 410, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["tbody tr[data-key='0'] [data-column=label]", "Row 0"] },
    { click: "thead th[data-column=value]" },
    { matches: 'thead th[data-column=value][aria-sort="ascending"]' },
  ],
});
