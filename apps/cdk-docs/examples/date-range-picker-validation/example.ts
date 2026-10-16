import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateRangePicker: validation",
  summary: "isRequired with native validation, minValue / maxValue, a reversed range, validate and FieldError children; aria validation shows errors at once.",
  tags: ["aria", "date", "forms", "validation"],
  status: "experimental",
  frame: { height: "xl" },
  show: ["src/routes/index.tsx", "src/components/RangePickerParts.tsx", "src/styles.css"],
  test: [
    { attr: ["#trip-start-input", "required", ""] },
    { attr: ["#trip-end-input", "required", ""] },
    { attr: [".rv-DateRangePicker:has(#trip)", "data-invalid", null] },
    { absent: "#trip-error" },
    { attr: [".rv-DateRangePicker:has(#october)", "data-invalid", "true"] },
    { described: ["#october", "Value must be 10/31/2026 or earlier."] },
    { attr: ["#october-end-day", "aria-invalid", "true"] },
    { described: ["#reversed", "Start date must be before end date."] },
    { described: ["#short", "At most 14 nights."] },
    { expect: ["#custom-error", "Bookings open on October 1."] },
    // Spinning an empty segment starts at the placeholder.
    { press: ["#trip-start-month", "ArrowUp"] },
    { attr: ["#trip-start-month", "aria-valuenow", "10"] },
    // A blocked submit shows the native error; picking a range from the calendar commits validation again.
    { click: "#submit" },
    { attr: [".rv-DateRangePicker:has(#trip)", "data-invalid", "true"] },
    { expect: ["#trip-error", "Please fill out this field."] },
    { click: "#trip-button" },
    { click: '[data-date="2026-10-16"]' },
    { click: '[data-date="2026-10-18"]' },
    { absent: "#trip-dialog" },
    { attr: [".rv-DateRangePicker:has(#trip)", "data-invalid", null] },
    { absent: "#trip-error" },
  ],
});
