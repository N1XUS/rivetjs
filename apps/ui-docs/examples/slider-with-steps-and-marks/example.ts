import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slider: With Steps and Marks",
  summary: 'Slider demo "With Steps and Marks".',
  tags: ["slider"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ['[data-slot=slider-mark][data-value="0.5"]', "0.5"] },
    { matches: '[data-slot=slider-step][data-value="0.9"]' },
    { press: ["[data-slot=slider-thumb] input", "ArrowRight"] },
    { attr: ['[data-slot=slider-mark][data-value="0.5"]', "data-filled", "true"] },
    { expect: ["[data-slot=slider-output]", "0.5"] },
  ],
});
