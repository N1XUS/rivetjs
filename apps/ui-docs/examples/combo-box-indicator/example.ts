import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ComboBox: Indicator",
  summary:
    "Morph chevron: the default indicator flattens into a line and folds up while open; size, stroke and duration hooks; duration 0s turns the morph off.",
  tags: ["combo-box"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=combo-box-trigger]" }, { attr: ["[data-slot=combo-box-trigger-default-icon]", "data-open", "true"] }],
});
