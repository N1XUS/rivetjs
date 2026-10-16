import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Footer",
  summary: "`footer` renders below the table, outside the horizontal scroll: totals, pagination, notes.",
  tags: ["data-grid"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#data-grid-footer-total", "Total $2270"],
    },
  ],
});
