import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slider: Vertical",
  summary: 'Slider demo "Vertical".',
  tags: ["slider"],
  status: "experimental",
  frame: { height: 304, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=slider]", "data-orientation", "vertical"] }],
});
