import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorPicker: Tailwind CSS",
  summary: 'ColorPicker demo "Tailwind CSS".',
  tags: ["color-picker"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=color-picker-trigger]" }, { matches: "[data-slot=color-picker-popover].bg-surface" }],
});
