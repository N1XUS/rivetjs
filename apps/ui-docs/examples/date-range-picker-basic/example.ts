import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateRangePicker: Usage",
  summary: 'DateRangePicker demo "Usage".',
  tags: ["date-range-picker"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=date-range-picker-trigger]" }, { attr: ["[data-slot=date-range-picker-popover] [role=grid]", "role", "grid"] }],
});
