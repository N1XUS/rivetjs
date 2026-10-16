import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSelect: Custom Value",
  summary: "A function child of CellSelect.Value renders the selection: here a color dot next to the name.",
  tags: ["cell-select"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: [".cell-select__value", "Violet"] },
    { click: "[data-slot=cell-select-trigger]" },
    { click: "[role=option][data-key=green]" },
    { expect: [".cell-select__value", "Green"] },
  ],
});
