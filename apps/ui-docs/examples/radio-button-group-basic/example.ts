import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioButtonGroup: Usage",
  summary: "Selectable cards for one choice out of a few; arrow keys move the selection.",
  tags: ["radio-button-group"],
  status: "experimental",
  frame: { height: 280 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=radio-button-group-item]:has(input[value=large])" },
    { attr: ["[data-slot=radio-button-group-item]:has(input[value=large])", "data-selected", "true"] },
    { attr: ["[data-slot=radio-button-group-item]:has(input[value=medium])", "data-selected", null] },
  ],
});
