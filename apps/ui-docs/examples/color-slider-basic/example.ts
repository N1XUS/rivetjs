import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSlider: Usage",
  summary: 'ColorSlider demo "Usage".',
  tags: ["color-slider"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["[data-slot=color-slider-output]", "0°"] },
    { press: ["[data-slot=color-slider] input", "ArrowRight"] },
    { expect: ["[data-slot=color-slider-output]", "1°"] },
  ],
});
