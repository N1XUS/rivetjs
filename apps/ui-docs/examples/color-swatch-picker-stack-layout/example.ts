import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSwatchPicker: Stack Layout",
  summary: 'ColorSwatchPicker demo "Stack Layout".',
  tags: ["color-swatch-picker"],
  status: "experimental",
  frame: { height: 320, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=color-swatch-picker].color-swatch-picker--stack" }],
});
