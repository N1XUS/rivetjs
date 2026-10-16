import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxButtonGroup: Grid Layout",
  summary: 'layout="grid" places the cards in equal columns (auto-fill, 12rem minimum).',
  tags: ["checkbox-button-group"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: ".checkbox-button-group--grid" },
    { click: "[data-slot=checkbox-button-group-item]:has(input[value=camera])" },
    { attr: ["[data-slot=checkbox-button-group-item]:has(input[value=camera])", "data-selected", "true"] },
  ],
});
