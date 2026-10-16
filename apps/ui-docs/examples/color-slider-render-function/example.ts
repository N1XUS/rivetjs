import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSlider: Render Function",
  summary: 'ColorSlider demo "Render Function".',
  tags: ["color-slider"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=color-slider]", "data-custom", "foo"] }],
});
