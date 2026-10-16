import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioButtonGroup: Shorthand",
  summary: "Rivet addition: `label` and `items` props instead of the Label and one Item (Indicator, ItemContent with Label + Description) per option.",
  tags: ["radio-button-group"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { name: ["[role=radiogroup]", "Workspace size"] },
    { click: "[data-slot=radio-button-group-field]:nth-of-type(3) [data-slot=radio-button-group-item]" },
    { attr: ["[data-slot=radio-button-group-field]:nth-of-type(3) [data-slot=radio-button-group-item]", "data-selected", "true"] },
  ],
});
