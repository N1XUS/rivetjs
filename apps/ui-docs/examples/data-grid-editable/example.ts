import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Editable Cells",
  summary: "Inputs inside cells keep their own keys (Escape returns to grid navigation); edits write back to the data signal.",
  tags: ["data-grid"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#data-grid-editable-total", "Total stock: 142"],
    },
  ],
});
