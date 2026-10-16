import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberStepper: Usage",
  summary: "A pill stepper: the buttons step the value, the digits roll in when they change, and the value stays editable.",
  tags: ["number-stepper"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{"click": "[data-slot=number-stepper-increment-button]"}, {"expect": ["[data-slot=number-stepper-display]", "2"]}, {"click": "[data-slot=number-stepper-decrement-button]"}, {"click": "[data-slot=number-stepper-decrement-button]"}, {"expect": ["[data-slot=number-stepper-display]", "0"]}, {"attr": ["[data-slot=number-stepper-decrement-button]", "disabled", ""]}],
});
