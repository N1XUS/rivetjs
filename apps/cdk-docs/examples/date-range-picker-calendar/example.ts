import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateRangePicker: popover calendar",
  summary:
    "The popover holds any RangeCalendar composition: two months side by side (visibleDuration + CalendarGrid offset), short weekday names, a lucide button icon.",
  tags: ["aria", "date", "calendar", "overlay"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#trip-button svg" },
    { click: "#trip-button" },
    { expect: ["#trip-dialog .rv-Heading", "October – November 2026"] },
    { matches: "#trip-dialog .months table + table" },
    { expect: ["#trip-dialog th", "Sun"] },
    // A range across the two grids.
    { click: '[data-date="2026-10-28"]' },
    { click: '[data-date="2026-11-03"]' },
    { absent: "#trip-dialog" },
    { expect: ["#value", "Value: 2026-10-28 → 2026-11-03"] },
  ],
});
