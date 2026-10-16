import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slider: Custom Output",
  summary: 'Slider demo "Custom Output".',
  tags: ["slider"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["[data-slot=slider-output]", "25 – 75"] }],
});
