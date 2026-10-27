import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellColorPicker: Disabled",
  summary: "isDisabled turns the cell off.",
  tags: ["cell-color-picker"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["#ccp-off", "disabled", ""],
    },
  ],
});
