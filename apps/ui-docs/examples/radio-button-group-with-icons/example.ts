import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioButtonGroup: With Icons",
  summary: "ItemIcon adds a leading icon tile; it turns accent-tinted on the selected card.",
  tags: ["radio-button-group"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=radio-button-group-item]:has(input[value=local])" },
    { attr: ["[data-slot=radio-button-group-item]:has(input[value=local])", "data-selected", "true"] },
  ],
});
