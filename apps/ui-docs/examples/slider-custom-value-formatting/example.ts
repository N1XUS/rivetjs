import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slider: Custom Value Formatting",
  summary: 'Slider demo "Custom Value Formatting".',
  tags: ["slider"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["[data-slot=slider-output]", "$60.00"] }],
});
