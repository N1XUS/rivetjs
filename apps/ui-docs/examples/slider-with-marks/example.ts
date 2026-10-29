import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slider: With Marks",
  summary: 'Slider demo "With Marks".',
  tags: ["slider"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ['[data-slot=slider-mark][data-value="60"]', "Loud"] },
    { attr: ['[data-slot=slider-mark][data-value="60"]', "data-filled", null] },
    { press: ["[data-slot=slider-thumb] input", "End"] },
    { attr: ['[data-slot=slider-mark][data-value="60"]', "data-filled", "true"] },
  ],
});
