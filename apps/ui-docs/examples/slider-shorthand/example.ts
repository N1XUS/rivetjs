import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slider: Shorthand",
  summary: "Rivet addition: `label` without children renders the Label, Output, Track, Fill and one Thumb per value.",
  tags: ["slider"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ name: ["input[type=range]", "Volume"] }, { press: ["input[type=range]", "ArrowRight"] }, { expect: ["[data-slot=slider-output]", "31"] }],
});
