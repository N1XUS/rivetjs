import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSlider: RGB Channels",
  summary: 'ColorSlider demo "RGB Channels".',
  tags: ["color-slider"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ press: ["[data-slot=color-slider] input >> nth=0", "ArrowLeft"] }, { expect: ["code", "rgb(254, 100, 50)"] }],
});
