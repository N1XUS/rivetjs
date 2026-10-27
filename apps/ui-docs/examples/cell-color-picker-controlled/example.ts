import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellColorPicker: Controlled",
  summary: "value takes a two-way signal of the color string.",
  tags: ["cell-color-picker"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#ccp-ctrl-value", "Value: #8B5CF6"],
    },
  ],
});
