import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxButtonGroup: Render Prop Children",
  summary: "A function child gets the item render props (accessors) to change the card content with its state.",
  tags: ["checkbox-button-group"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=checkbox-button-group-item]:has(input[value=day])" },
    { attr: ["[data-slot=checkbox-button-group-item]:has(input[value=day])", "data-selected", "true"] },
    { expect: ["[data-slot=checkbox-button-group-item]:has(input[value=day])", "(on)"] },
  ],
});
