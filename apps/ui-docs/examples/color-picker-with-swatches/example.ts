import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorPicker: With Swatches",
  summary: 'ColorPicker demo "With Swatches".',
  tags: ["color-picker"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=color-picker-trigger]" },
    { click: "[data-slot=color-picker-popover] [role=option] >> nth=3" },
    { matches: '[data-slot=color-picker-trigger] [data-slot=color-swatch][style*="34, 197, 94"]' },
  ],
});
