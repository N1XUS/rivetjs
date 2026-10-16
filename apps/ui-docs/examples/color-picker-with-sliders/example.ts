import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorPicker: With Sliders",
  summary: 'ColorPicker demo "With Sliders".',
  tags: ["color-picker"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=color-picker-trigger]" }, { expect: ["[data-slot=color-picker-popover] [data-slot=color-slider] label", "hue"] }],
});
