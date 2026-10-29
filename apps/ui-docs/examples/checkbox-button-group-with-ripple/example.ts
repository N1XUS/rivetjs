import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxButtonGroup: With Ripple",
  summary: "Each card holds a PressableFeedback.Ripple: it grows from the pointer, or from the centre when Space toggles the focused card.",
  tags: ["checkbox-button-group", "pressable-feedback"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["[data-slot=checkbox-button-group-item] input[value=sms]", "Space"] },
    { attr: ["[data-slot=checkbox-button-group-item]:has(input[value=sms]) [data-slot=pressable-feedback-ripple]", "data-pressed", "true"] },
    { attr: ["[data-slot=checkbox-button-group-item]:has(input[value=sms])", "data-selected", "true"] },
    { click: "[data-slot=checkbox-button-group-item]:has(input[value=push])" },
    { attr: ["[data-slot=checkbox-button-group-item]:has(input[value=push]) [data-slot=pressable-feedback-ripple]", "data-pressed", "true"] },
  ],
});
