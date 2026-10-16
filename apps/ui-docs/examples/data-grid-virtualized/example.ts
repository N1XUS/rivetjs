import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Virtualization",
  summary: "`virtualized` renders only the rows in view (fixed `rowHeight`): 10 000 rows, sorting and selection included.",
  tags: ["data-grid"],
  status: "experimental",
  frame: { height: 452, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["tbody tr[data-key='0'] [data-column=sensor]", "S-00000"],
    },
  ],
});
