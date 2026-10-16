import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberStepper: Shorthand",
  summary: "Rivet addition: no children: the Group with the decrement button, the value and the increment button.",
  tags: ["number-stepper"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=number-stepper-increment-button]" }, { expect: ["[data-slot=number-stepper-display]", "2"] }],
});
