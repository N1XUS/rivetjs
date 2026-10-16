import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Bulk Actions",
  summary: "A toolbar acting on the selection: archive or clear the selected rows.",
  tags: ["data-grid"],
  status: "experimental",
  frame: { height: 402, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "[data-rv-select-all]",
    },
    {
      expect: ["#data-grid-bulk-count", "6 selected"],
    },
  ],
});
