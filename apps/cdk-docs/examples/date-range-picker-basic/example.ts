import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateRangePicker",
  summary: "Start and end DateInputs in a Group with a calendar button; a RangeCalendar popover: two clicks select a range, typing works in both fields.",
  tags: ["aria", "date", "forms", "overlay"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css", "src/components/Icon.tsx"],
  test: [
    { attr: ["#stay", "role", "group"] },
    { name: ["#stay", "Stay"] },
    { attr: ["#stay-start", "role", "presentation"] },
    { attr: ["#stay-start-month", "aria-label", "month, Start Date, "] },
    { attr: ["#stay-end-month", "aria-label", "month, End Date, "] },
    { expect: ["#stay-start", "mm/dd/yyyy"] },
    // RAC: the picker's fields are presentation; their segments are described by the picker (value + description).
    { described: ["#stay-start-month", "Check-in to check-out."] },
    { matches: "#stay-button svg" },
    { click: "#stay-button" },
    { matches: "#stay-dialog .rv-RangeCalendar" },
    { focused: '[data-date="2026-10-14"]' },
    { click: '[data-date="2026-10-16"]' },
    { matches: "#stay-dialog" },
    { click: '[data-date="2026-10-20"]' },
    { absent: "#stay-dialog" },
    { expect: ["#value", "Value: 2026-10-16 → 2026-10-20"] },
    { expect: ["#stay-start", "10/16/2026"] },
    { expect: ["#stay-end", "10/20/2026"] },
    { described: ["#stay", "Selected Range: October 16 to 20, 2026"] },
    { described: ["#stay-start-month", "Selected Range: October 16 to 20, 2026 Check-in to check-out."] },
    // Typing in the end field; ArrowRight from the start field's last segment moves into the end field.
    { press: ["#stay-end-day", "ArrowUp"] },
    { expect: ["#value", "Value: 2026-10-16 → 2026-10-21"] },
    { press: ["#stay-start-year", "ArrowRight"] },
    { focused: "#stay-end-month" },
  ],
});
