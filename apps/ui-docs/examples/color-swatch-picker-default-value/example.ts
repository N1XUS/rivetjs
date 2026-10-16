import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSwatchPicker: Default Value",
  summary: 'ColorSwatchPicker demo "Default Value".',
  tags: ["color-swatch-picker"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[role=option]:nth-child(3)[aria-selected=true]" }],
});
