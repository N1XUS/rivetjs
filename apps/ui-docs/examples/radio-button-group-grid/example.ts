import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioButtonGroup: Grid Layout",
  summary: 'layout="grid" places the cards in equal columns (auto-fill, 12rem minimum).',
  tags: ["radio-button-group"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: ".radio-button-group--grid" },
    { click: "[data-slot=radio-button-group-item]:has(input[value=camera])" },
    { attr: ["[data-slot=radio-button-group-item]:has(input[value=camera])", "data-selected", "true"] },
  ],
});
