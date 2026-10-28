import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateRangePicker: Controlled",
  summary: 'DateRangePicker demo "Controlled".',
  tags: ["date-range-picker"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "text=Clear" },
    { expect: ["[data-slot=description]", "(empty)"] },
    { click: "[data-slot=date-range-picker-trigger]" },
    { click: '[data-date$="-10"]:not([data-outside-month])' },
    { expect: ["[data-slot=description]", "(empty)"] },
    { matches: "[data-slot=date-range-picker-popover] [role=grid]" },
    { click: '[data-date$="-12"]:not([data-outside-month])' },
    { absent: "[data-slot=date-range-picker-popover]" },
    { expect: ["[data-slot=description]", "-10 -> "] },
    { expect: ["[data-slot=description]", "-12"] },
    { click: "text=Set week" },
    { expect: ["[data-slot=description]", " -> 20"] },
  ],
});
