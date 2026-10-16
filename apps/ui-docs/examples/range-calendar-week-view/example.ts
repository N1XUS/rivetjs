import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RangeCalendar: Week View",
  summary: 'RangeCalendar demo "Week View".',
  tags: ["range-calendar"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=select-trigger]" },
    { click: '[role=option][data-key="3"]' },
    { expect: ["[data-slot=select-value]", "3 weeks"] },
    { attr: ["[role=grid] tbody tr:nth-child(3) td", "role", "gridcell"] },
  ],
});
