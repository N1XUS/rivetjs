import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberStepper: Controlled",
  summary: "A two-way value signal: the stepper writes the value, buttons outside write it back.",
  tags: ["number-stepper"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [{"click": "[data-slot=number-stepper-increment-button]"}, {"expect": ["#seats", "5"]}, {"click": "button[data-slot=button]"}, {"expect": ["#seats", "25"]}, {"expect": ["[data-slot=number-stepper-display]", "25"]}],
});
