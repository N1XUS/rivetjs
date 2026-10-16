import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSelect: Settings Group",
  summary: "A stack of cells on a card: a regional settings panel.",
  tags: ["cell-select"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["[data-slot=cell-select]:nth-of-type(3) .cell-select__value", "2026-10-08"] },
    { click: "[data-slot=cell-select]:nth-of-type(2) [data-slot=cell-select-trigger]" },
    { click: "[role=option][data-key=apac]" },
    { expect: ["[data-slot=cell-select]:nth-of-type(2) .cell-select__value", "Asia Pacific"] },
  ],
});
