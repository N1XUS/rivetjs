import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorPicker: With Fields",
  summary: 'ColorPicker demo "With Fields".',
  tags: ["color-picker"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=color-picker-trigger]" }, { attr: ["[data-slot=color-picker-popover] [data-slot=color-field] input", "aria-label", "hue"] }],
});
