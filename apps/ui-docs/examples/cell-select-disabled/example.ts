import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSelect: Disabled",
  summary: "isDisabled turns off the whole cell; disabledKeys turns off single options.",
  tags: ["cell-select"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["[data-slot=cell-select-trigger]", "disabled", ""] },
    { click: "[data-slot=cell-select]:nth-of-type(2) [data-slot=cell-select-trigger]" },
    { attr: ["[role=option][data-key=hourly]", "aria-disabled", "true"] },
  ],
});
