import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberStepper: Guest Picker",
  summary: "A booking-style picker: one labelled stepper per row with its own bounds.",
  tags: ["number-stepper"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [{"click": "[data-slot=number-stepper]:nth-of-type(2) [data-slot=number-stepper-increment-button]"}, {"expect": ["[data-slot=number-stepper]:nth-of-type(2) [data-slot=number-stepper-display]", "2"]}, {"attr": ["[data-slot=number-stepper]:nth-of-type(1) [data-slot=number-stepper-decrement-button]", "disabled", null]}],
});
