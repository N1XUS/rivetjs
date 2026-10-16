import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSwatchPicker: Tailwind CSS",
  summary: 'ColorSwatchPicker demo "Tailwind CSS".',
  tags: ["color-swatch-picker"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=color-swatch-picker].rounded-2xl" }],
});
