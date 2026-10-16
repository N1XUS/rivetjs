import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slider: Usage",
  summary: 'Slider demo "Usage".',
  tags: ["slider"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["[data-slot=slider-output]", "30"] }, { attr: ["input[type=range]", "value", "30"] }],
});
