import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSwatchPicker: Custom Indicator",
  summary: 'ColorSwatchPicker demo "Custom Indicator".',
  tags: ["color-swatch-picker"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[role=option] >> nth=1" }, { matches: "[role=option][aria-selected=true] [data-slot=color-swatch-picker-indicator] svg" }],
});
