import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSlider: Disabled",
  summary: 'ColorSlider demo "Disabled".',
  tags: ["color-slider"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=color-slider]", "data-disabled", "true"] }],
});
