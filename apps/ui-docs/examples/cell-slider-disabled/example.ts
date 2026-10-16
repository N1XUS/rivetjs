import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSlider: Disabled",
  summary: "isDisabled dims the cell and ignores presses and keys.",
  tags: ["cell-slider"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=cell-slider]", "data-disabled", "true"] }, { attr: ["input[type=range]", "disabled", ""] }],
});
