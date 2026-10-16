import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberStepper: Reversed Layout",
  summary: "Order the parts freely: here the value comes first and both buttons follow.",
  tags: ["number-stepper"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{"click": "[data-slot=number-stepper-increment-button]"}, {"expect": ["[data-slot=number-stepper-display]", "2"]}],
});
