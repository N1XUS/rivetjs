import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slider: Render Function",
  summary: 'Slider demo "Render Function".',
  tags: ["slider"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-custom=foo][data-slot=slider]" }],
});
