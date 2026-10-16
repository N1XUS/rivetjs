import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Row Selection",
  summary: "Multiple selection with checkboxes, select-all, Shift-range and a disabled row; the selection is a signal.",
  tags: ["data-grid"],
  status: "experimental",
  frame: { height: 390, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#data-grid-selection-count", "1 selected"],
    },
    {
      click: "tbody tr[data-key='4'] [data-rv-select]",
    },
    {
      expect: ["#data-grid-selection-count", "2 selected"],
    },
  ],
});
