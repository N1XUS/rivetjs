import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slider: Range with Steps and Marks",
  summary: 'Slider demo "Range with Steps and Marks".',
  tags: ["slider"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["[data-slot=slider-output]", "0.2 – 0.8"] },
    { attr: ['[data-slot=slider-mark][data-value="0"]', "data-filled", null] },
    { press: ["[data-slot=slider-thumb] input", "Home"] },
    { attr: ['[data-slot=slider-mark][data-value="0"]', "data-filled", "true"] },
    { attr: ['[data-slot=slider-step][data-value="0.9"]', "data-filled", null] },
  ],
});
