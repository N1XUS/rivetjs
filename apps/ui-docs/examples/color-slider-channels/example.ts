import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSlider: HSL Channels",
  summary: 'ColorSlider demo "HSL Channels".',
  tags: ["color-slider"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ press: ["[data-slot=color-slider] input >> nth=0", "ArrowRight"] }, { expect: ["code", "hsl(1, 100%, 50%)"] }],
});
