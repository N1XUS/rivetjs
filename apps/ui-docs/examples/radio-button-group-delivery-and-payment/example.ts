import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioButtonGroup: Delivery And Payment",
  summary: "Two groups in a checkout step: delivery speed with prices, then the payment method with icons.",
  tags: ["radio-button-group"],
  status: "experimental",
  frame: { height: 528, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=radio-button-group-item]:has(input[value=express])" },
    { attr: ["[data-slot=radio-button-group-item]:has(input[value=express])", "data-selected", "true"] },
    { click: "[data-slot=radio-button-group-item]:has(input[value=bank])" },
    { attr: ["[data-slot=radio-button-group-item]:has(input[value=bank])", "data-selected", "true"] },
  ],
});
