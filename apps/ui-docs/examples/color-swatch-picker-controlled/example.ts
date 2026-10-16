import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSwatchPicker: Controlled",
  summary: 'ColorSwatchPicker demo "Controlled".',
  tags: ["color-swatch-picker"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["p", "Selected: #F43F5E"] }, { click: "[role=option] >> nth=3" }, { expect: ["p", "Selected: #3B82F6"] }],
});
