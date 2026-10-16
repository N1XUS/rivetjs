import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSelect: Font Family",
  summary: "Each option renders in its own font, and the selected value keeps it.",
  tags: ["cell-select"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: [".cell-select__value", "Georgia"] },
    { click: "[data-slot=cell-select-trigger]" },
    { click: "[role=option][data-key=mono]" },
    { expect: [".cell-select__value", "Menlo"] },
  ],
});
