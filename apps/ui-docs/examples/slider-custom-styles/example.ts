import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slider: Tailwind CSS",
  summary: 'Slider demo "Tailwind CSS".',
  tags: ["slider"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=slider-thumb].bg-accent" }],
});
