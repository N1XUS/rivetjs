import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberStepper: Disabled",
  summary: "isDisabled disables both buttons and the input.",
  tags: ["number-stepper"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{"attr": ["[data-slot=number-stepper-increment-button]", "disabled", ""]}, {"attr": ["input", "disabled", ""]}],
});
