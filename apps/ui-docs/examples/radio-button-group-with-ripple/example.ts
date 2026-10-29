import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioButtonGroup: With Ripple",
  summary: "Each card holds a PressableFeedback.Ripple: it grows from the pointer, or from the centre when Space selects the focused card.",
  tags: ["radio-button-group", "pressable-feedback"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["[data-slot=radio-button-group-item] input[value=express]", "Space"] },
    { attr: ["[data-slot=radio-button-group-item]:has(input[value=express]) [data-slot=pressable-feedback-ripple]", "data-pressed", "true"] },
    { attr: ["[data-slot=radio-button-group-item]:has(input[value=express])", "data-selected", "true"] },
    { click: "[data-slot=radio-button-group-item]:has(input[value=same-day])" },
    { attr: ["[data-slot=radio-button-group-item]:has(input[value=same-day]) [data-slot=pressable-feedback-ripple]", "data-pressed", "true"] },
  ],
});
