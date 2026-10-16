import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Drag and Drop",
  summary: "`onReorder` adds a drag handle column: drag rows with the pointer, or press Enter on a handle and move with the arrow keys.",
  tags: ["data-grid"],
  status: "experimental",
  frame: { height: 333, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["tbody tr[data-key='1'] [data-rv-drag-handle]", ""],
    },
  ],
});
