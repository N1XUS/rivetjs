import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RangeCalendar",
  summary: "Press a start day and an end day (or drag); with the keyboard, Enter anchors, arrows extend, Enter completes. The value is { start, end } strings.",
  tags: ["cdk", "range-calendar", "dates"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#trip", "class", "rv-RangeCalendar"] },
    { attr: ["#trip", "role", "application"] },
    { attr: ["#trip", "aria-label", "Trip, October 2026"] },
    { attr: ["#trip table", "aria-multiselectable", "true"] },
    { expect: ["#trip .rv-Heading", "October 2026"] },
    { attr: ['#trip [data-date="2026-10-05"]', "data-selection-start", "true"] },
    { attr: ['#trip [data-date="2026-10-07"]', "data-selected", "true"] },
    { attr: ['#trip [data-date="2026-10-09"]', "data-selection-end", "true"] },
    // Mouse: start, then end.
    { click: '#trip [data-date="2026-10-12"]' },
    { attr: ['#trip [data-date="2026-10-12"]', "data-selection-start", "true"] },
    { attr: ['#trip [data-date="2026-10-07"]', "data-selected", null] },
    { click: '#trip [data-date="2026-10-16"]' },
    { expect: ["#value", "2026-10-12 → 2026-10-16"] },
    // Keyboard: Enter anchors (focus moves on a day), arrows extend, Enter completes.
    { press: ['#trip [data-date="2026-10-20"]', "Enter"] },
    { focused: '[data-date="2026-10-21"]' },
    { attr: ['#trip [data-date="2026-10-21"]', "aria-describedby", "trip-finish-prompt"] },
    { key: "ArrowDown" },
    { focused: '[data-date="2026-10-28"]' },
    { key: "Enter" },
    { expect: ["#value", "2026-10-20 → 2026-10-28"] },
    // Escape cancels a selection in progress.
    { key: "ArrowRight" },
    { key: "Enter" },
    { key: "Escape" },
    { attr: ['#trip [data-date="2026-10-20"]', "data-selection-start", "true"] },
    { expect: ["#value", "2026-10-20 → 2026-10-28"] },
    { click: '#trip button[aria-label="Next"]' },
    { expect: ["#trip .rv-Heading", "November 2026"] },
  ],
});
