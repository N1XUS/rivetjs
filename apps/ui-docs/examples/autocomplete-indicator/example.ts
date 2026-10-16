import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Autocomplete: Indicator",
  summary:
    "Morph chevron: the default indicator flattens into a line and folds up while open; size, stroke and duration hooks; duration 0s turns the morph off.",
  tags: ["autocomplete"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=autocomplete-trigger]" }, { attr: ["[data-slot=autocomplete-default-indicator]", "data-open", "true"] }],
});
