import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSlider: Shorthand",
  summary: "Rivet addition: without children, `label` renders the track (fill, thumb), the Label and the Output.",
  tags: ["cell-slider"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx"],
  test: [{ name: ["input[type=range]", "Volume"] }, { press: ["input[type=range]", "ArrowRight"] }, { expect: ["output", "61"] }],
});
