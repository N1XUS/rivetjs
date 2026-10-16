import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DatePicker: Usage",
  summary: 'DatePicker demo "Usage".',
  tags: ["date-picker"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=date-picker-trigger]" }, { attr: ["[data-slot=date-picker-popover] [role=grid]", "role", "grid"] }],
});
