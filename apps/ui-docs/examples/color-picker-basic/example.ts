import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorPicker: Usage",
  summary: 'ColorPicker demo "Usage".',
  tags: ["color-picker"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=color-picker-trigger]" },
    { matches: "[data-slot=color-picker-popover] [data-slot=color-area]" },
    { key: "Escape" },
    { absent: "[data-slot=color-picker-popover]" },
  ],
});
