import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSlider: Controlled",
  summary: 'ColorSlider demo "Controlled".',
  tags: ["color-slider"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["code", "hsl(200, 100%, 50%)"] }, { press: ["[data-slot=color-slider] input", "ArrowRight"] }, { expect: ["code", "hsl(201, 100%, 50%)"] }],
});
