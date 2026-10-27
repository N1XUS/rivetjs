import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellColorPicker: Usage",
  summary: "The whole row opens the picker; the value display shows the hex value and the swatch previews it.",
  tags: ["cell-color-picker"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#ccp-basic [data-slot=cell-color-picker-value-display]", "#3B82F6"],
    },
    {
      click: "#ccp-basic",
    },
    {
      matches: "[data-slot=color-picker-popover]",
    },
  ],
});
