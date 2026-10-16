import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Empty State",
  summary: "`renderEmptyState` fills the body when there are no rows.",
  tags: ["data-grid"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["tbody tr[data-empty]", "No invoices yet"],
    },
  ],
});
