import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSlider: Integer Step",
  summary: "step={1} on a small range: dragging moves freely and snaps to the nearest whole value on release.",
  tags: ["cell-slider"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ press: ["input[type=range]", "ArrowRight"] }, { key: "ArrowRight" }, { expect: ["[data-slot=cell-slider-output]", "5"] }],
});
