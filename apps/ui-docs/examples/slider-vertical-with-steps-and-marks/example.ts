import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slider: Vertical with Steps and Marks",
  summary: 'Slider demo "Vertical with Steps and Marks".',
  tags: ["slider"],
  status: "experimental",
  frame: { height: 304, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["[data-slot=slider-marks]", "data-orientation", "vertical"] },
    { press: ["[data-slot=slider-thumb] input", "ArrowUp"] },
    { attr: ['[data-slot=slider-mark][data-value="0.5"]', "data-filled", "true"] },
  ],
});
