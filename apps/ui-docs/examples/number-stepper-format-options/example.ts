import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberStepper: With Format Options",
  summary: "formatOptions (Intl.NumberFormat) format currency, percent and units; every changed character rolls.",
  tags: ["number-stepper"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{"click": "[data-slot=number-stepper-increment-button]"}, {"expect": ["[data-slot=number-stepper-display]", "50"]}],
});
