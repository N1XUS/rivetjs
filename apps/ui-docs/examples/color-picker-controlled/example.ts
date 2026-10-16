import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorPicker: Controlled",
  summary: 'ColorPicker demo "Controlled".',
  tags: ["color-picker"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["p", "Selected: #325578"] },
    { click: "[data-slot=color-picker-trigger]" },
    { click: "[data-slot=color-picker-popover] [role=option] >> nth=0" },
    { expect: ["p", "Selected: #EF4444"] },
  ],
});
