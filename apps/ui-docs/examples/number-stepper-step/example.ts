import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberStepper: With Step",
  summary: "step sets the increment; typed values snap to it on commit.",
  tags: ["number-stepper"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{"click": "[data-slot=number-stepper-increment-button]"}, {"expect": ["[data-slot=number-stepper-display]", "45"]}],
});
