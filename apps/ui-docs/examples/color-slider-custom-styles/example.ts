import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSlider: Tailwind CSS",
  summary: 'ColorSlider demo "Tailwind CSS".',
  tags: ["color-slider"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=color-slider-thumb].rounded-sm\\!" }],
});
