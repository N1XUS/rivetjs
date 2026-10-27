import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RangeCalendar: Year Picker",
  summary: 'RangeCalendar demo "Year Picker".',
  tags: ["range-calendar"],
  status: "experimental",
  frame: { height: 316, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=calendar-year-picker-trigger]" },
    // The year grid opened (the trigger says so) with the visible year selected.
    { attr: ["[data-slot=calendar-year-picker-trigger]", "aria-expanded", "true"] },
    { expect: ["[data-slot=calendar-year-picker-year-cell][aria-selected=true]", ""] },
    { key: "Escape" },
    { attr: ["[data-slot=calendar-year-picker-trigger]", "aria-expanded", "false"] },
  ],
});
