import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxButtonGroup: Custom Indicator",
  summary: "Indicator children replace the default mark; a function child gets the item state (accessors).",
  tags: ["checkbox-button-group"],
  status: "experimental",
  frame: { height: 280 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=checkbox-button-group-item]:has(input[value=coast])" },
    { attr: ["[data-slot=checkbox-button-group-item]:has(input[value=coast])", "data-selected", "true"] },
    { matches: "[data-slot=checkbox-button-group-item]:has(input[value=coast]) [data-custom] svg" },
  ],
});
