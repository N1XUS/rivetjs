import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSlider: Alpha Channel",
  summary: 'ColorSlider demo "Alpha Channel".',
  tags: ["color-slider"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["[data-slot=color-slider-output]", "50%"] },
    { press: ["[data-slot=color-slider] input", "ArrowRight"] },
    { expect: ["[data-slot=color-slider-output]", "51%"] },
  ],
});
