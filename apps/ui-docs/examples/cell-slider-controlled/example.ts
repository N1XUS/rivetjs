import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSlider: Controlled",
  summary: "A two-way value signal; onChangeEnd reports the value once the drag ends.",
  tags: ["cell-slider"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["input[type=range]", "ArrowRight"] },
    { expect: ["#live", "110"] },
    { expect: ["#committed", "110"] },
    { expect: ["[data-slot=cell-slider-output]", "110%"] },
  ],
});
