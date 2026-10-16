import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSwatchPicker: Sizes",
  summary: 'ColorSwatchPicker demo "Sizes".',
  tags: ["color-swatch-picker"],
  status: "experimental",
  frame: { height: 296, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=color-swatch-picker].color-swatch-picker--xl" }],
});
