import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RangeCalendar: Day View",
  summary: 'RangeCalendar demo "Day View".',
  tags: ["range-calendar"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=select-trigger]" },
    { click: '[role=option][data-key="7"]' },
    { expect: ["[data-slot=select-value]", "7 days"] },
    { attr: ["[role=grid] tbody tr td:nth-child(7)", "role", "gridcell"] },
  ],
});
