import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxButtonGroup: No Indicator",
  summary: "Leave out the Indicator: the accent border and ring alone show the selection.",
  tags: ["checkbox-button-group"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=checkbox-button-group-item]:has(input[value=de])" },
    { attr: ["[data-slot=checkbox-button-group-item]:has(input[value=de])", "data-selected", "true"] },
  ],
});
