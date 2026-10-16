import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSlider: Usage",
  summary: "A settings cell that is the slider: press or drag anywhere on it; the value shows on the right.",
  tags: ["cell-slider"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ press: ["input[type=range]", "ArrowRight"] }, { expect: ["[data-slot=cell-slider-output]", "61"] }],
});
