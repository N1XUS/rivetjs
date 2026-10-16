import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSwatchPicker: Disabled",
  summary: 'ColorSwatchPicker demo "Disabled".',
  tags: ["color-swatch-picker"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[role=option]", "aria-disabled", "true"] }],
});
