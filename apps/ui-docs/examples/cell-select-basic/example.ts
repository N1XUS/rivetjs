import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSelect: Usage",
  summary: "A settings row that opens a list: the label on the left, the selected value and a chevron on the right.",
  tags: ["cell-select"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: [".cell-select__value", "System"] },
    { click: "[data-slot=cell-select-trigger]" },
    { click: "[role=option][data-key=dark]" },
    { expect: [".cell-select__value", "Dark"] },
  ],
});
