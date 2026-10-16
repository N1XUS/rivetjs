import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSelect: Indicator",
  summary:
    "Morph chevron: the default indicator flattens into a line and folds up while open; size, stroke and duration hooks; duration 0s turns the morph off.",
  tags: ["cell-select"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=cell-select-trigger]" }, { attr: ["[data-slot=cell-select-default-indicator]", "data-open", "true"] }],
});
