import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSwatchPicker: Usage",
  summary: 'ColorSwatchPicker demo "Usage".',
  tags: ["color-swatch-picker"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[role=option] >> nth=2" }, { matches: "[role=option][aria-selected=true]" }],
});
