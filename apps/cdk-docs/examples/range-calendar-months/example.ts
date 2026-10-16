import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RangeCalendar: several months",
  summary: "visibleDuration of two months, a CalendarHeading and CalendarGrid per month (offset), pageBehavior single; a range crosses the month boundary.",
  tags: ["cdk", "range-calendar", "layout"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#holiday", "aria-label", "Holiday, October to November 2026"] },
    { expect: ["#holiday .month:nth-child(1) .rv-CalendarHeading", "October 2026"] },
    { expect: ["#holiday .month:nth-child(2) .rv-CalendarHeading", "November 2026"] },
    { attr: ['#holiday .month:nth-child(1) [data-date="2026-10-26"]', "data-selection-start", "true"] },
    { attr: ['#holiday .month:nth-child(2) [data-date="2026-11-06"]', "data-selection-end", "true"] },
    { press: ['#holiday .month:nth-child(1) [data-date="2026-10-29"]', "Enter"] },
    { focused: '#holiday .month:nth-child(1) [data-date="2026-10-30"]' },
    // Focus flows into the next month's grid.
    { key: "ArrowDown" },
    { focused: '#holiday .month:nth-child(2) [data-date="2026-11-06"]' },
    { key: "ArrowLeft" },
    { key: "Enter" },
    { expect: ["#value", "2026-10-29 → 2026-11-05"] },
    // pageBehavior="single": Next moves one month.
    { click: '#holiday button[aria-label="Next"]' },
    { attr: ["#holiday", "aria-label", "Holiday, November to December 2026"] },
    { expect: ["#holiday .month:nth-child(1) .rv-CalendarHeading", "November 2026"] },
  ],
});
