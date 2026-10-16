import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxButtonGroup: Usage",
  summary: "Selectable cards for several independent choices; each card toggles on click or Space.",
  tags: ["checkbox-button-group"],
  status: "experimental",
  frame: { height: 280 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=checkbox-button-group-item]:has(input[value=push])" },
    { attr: ["[data-slot=checkbox-button-group-item]:has(input[value=push])", "data-selected", "true"] },
    { attr: ["[data-slot=checkbox-button-group-item]:has(input[value=email])", "data-selected", "true"] },
  ],
});
