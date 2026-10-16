import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSelect: Shorthand",
  summary: "Rivet addition: `label` renders the trigger row (label, value, chevron), the popover and the list; `CellSelect.Item` adds the indicator.",
  tags: ["cell-select"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: [".cell-select__value", "System"] },
    { click: "[data-slot=cell-select-trigger]" },
    { click: "[role=option][data-key=dark]" },
    { expect: [".cell-select__value", "Dark"] },
  ],
});
