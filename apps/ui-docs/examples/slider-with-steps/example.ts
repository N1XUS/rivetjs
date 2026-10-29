import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slider: With Steps",
  summary: 'Slider demo "With Steps".',
  tags: ["slider"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: '[data-slot=slider-step][data-value="100"]' },
    { attr: ['[data-slot=slider-step][data-value="50"]', "data-filled", null] },
    { press: ["[data-slot=slider-thumb] input", "ArrowRight"] },
    { attr: ['[data-slot=slider-step][data-value="50"]', "data-filled", "true"] },
    { expect: ["[data-slot=slider-output]", "50"] },
  ],
});
