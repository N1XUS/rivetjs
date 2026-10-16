import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateRangePicker: Format Options",
  summary: 'DateRangePicker demo "Format Options".',
  tags: ["date-range-picker"],
  status: "experimental",
  frame: { height: 337, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=select-trigger] >> nth=1" },
    { click: '[role=option][data-key="24"]' },
    { expect: [".flex-wrap > div:nth-child(2) [data-slot=select-value]", "24-hour"] },
    { click: "[data-slot=date-range-picker-trigger]" },
    { attr: ["[data-slot=date-range-picker-popover] [data-slot=time-field]", "data-slot", "time-field"] },
    { expect: ["[data-slot=date-range-picker-popover] span.text-xs", "Selected: Feb 3"] },
  ],
});
