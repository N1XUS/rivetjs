import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSwatchPicker: Variants",
  summary: 'ColorSwatchPicker demo "Variants".',
  tags: ["color-swatch-picker"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=color-swatch-picker].color-swatch-picker--square" }],
});
