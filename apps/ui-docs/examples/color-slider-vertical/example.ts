import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSlider: Vertical",
  summary: 'ColorSlider demo "Vertical".',
  tags: ["color-slider"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["[data-slot=color-slider]", "data-orientation", "vertical"] },
    { press: ["[data-slot=color-slider] input >> nth=0", "ArrowUp"] },
    { attr: ["[data-slot=color-slider] input", "aria-valuetext", "1°, red"] },
  ],
});
