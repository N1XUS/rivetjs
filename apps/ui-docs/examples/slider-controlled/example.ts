import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slider: Controlled Value",
  summary: 'Slider demo "Controlled Value".',
  tags: ["slider"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["p", "Current value: 25"] }, { expect: ["[data-slot=slider-output]", "25"] }],
});
