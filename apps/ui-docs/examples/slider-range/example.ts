import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slider: Range",
  summary: 'Slider demo "Range".',
  tags: ["slider"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["[data-slot=slider-output]", "$100.00 – $500.00"] }, { matches: "[data-slot=slider-thumb] ~ [data-slot=slider-thumb]" }],
});
