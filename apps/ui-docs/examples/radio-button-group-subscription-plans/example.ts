import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioButtonGroup: Subscription Plans",
  summary: "Plan cards with an icon, a description and the price on the trailing edge.",
  tags: ["radio-button-group"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=radio-button-group-item]:has(input[value=enterprise])" },
    { attr: ["[data-slot=radio-button-group-item]:has(input[value=enterprise])", "data-selected", "true"] },
  ],
});
