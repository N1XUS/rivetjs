import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateRangePicker: calendar options",
  summary:
    "isDateUnavailable (with the anchor date), allowsNonContiguousRanges, minValue / maxValue, firstDayOfWeek and shouldCloseOnSelect reach the popover's RangeCalendar.",
  tags: ["aria", "date", "calendar"],
  status: "experimental",
  frame: { height: "xl" },
  show: ["src/routes/index.tsx", "src/components/RangePickerParts.tsx", "src/styles.css"],
  test: [
    // Contiguous only: after picking Thu Oct 15, the days past the weekend are disabled.
    { click: "#work-button" },
    { expect: ["#work-dialog th", "M"] },
    { click: '[data-date="2026-10-15"]' },
    { attr: ['[data-date="2026-10-19"]', "data-disabled", "true"] },
    { click: '[data-date="2026-10-16"]' },
    { absent: "#work-dialog" },
    // Non-contiguous: a range across the weekend; the popover stays open.
    { click: "#leave-button" },
    { click: '[data-date="2026-10-15"]' },
    { click: '[data-date="2026-10-20"]' },
    { matches: "#leave-dialog" },
    { expect: ["#value", "Work: 2026-10-15 → 2026-10-16 · Leave: 2026-10-15 → 2026-10-20"] },
    { key: "Escape" },
    { absent: "#leave-dialog" },
    // Anchor-based: more than 7 days from the first click is unavailable.
    { click: "#week-button" },
    { click: '[data-date="2026-10-14"]' },
    { attr: ['[data-date="2026-10-22"]', "data-unavailable", "true"] },
    { attr: ['[data-date="2026-10-21"]', "data-unavailable", null] },
    { key: "Escape" },
  ],
});
