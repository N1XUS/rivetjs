import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberStepper: Min Max Values",
  summary: "minValue / maxValue clamp the value; the button at a bound is disabled.",
  tags: ["number-stepper"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{"click": "[data-slot=number-stepper-increment-button]"}, {"expect": ["[data-slot=number-stepper-display]", "3"]}, {"attr": ["[data-slot=number-stepper-increment-button]", "disabled", ""]}],
});
