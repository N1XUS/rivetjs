import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSlider: Settings Group",
  summary: "A stack of cells as an image-adjustments panel, values formatted per row.",
  tags: ["cell-slider"],
  status: "experimental",
  frame: { height: 280 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["[data-slot=cell-slider]:nth-of-type(4) [data-slot=cell-slider-output]", "25%"] }],
});
