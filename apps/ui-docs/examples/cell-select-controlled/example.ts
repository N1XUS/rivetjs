import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSelect: Controlled",
  summary: "A two-way value signal: the select writes it, and writing it updates the cell.",
  tags: ["cell-select"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=cell-select-trigger]" },
    { click: "[role=option][data-key=imperial]" },
    { expect: ["#units", "imperial"] },
    { click: "button:has-text('Reset')" },
    { expect: [".cell-select__value", "Metric"] },
  ],
});
