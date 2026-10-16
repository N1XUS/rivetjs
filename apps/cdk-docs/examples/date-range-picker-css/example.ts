import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateRangePicker: plain CSS",
  summary:
    "Plain rules on the rv-* classes: the group by data-focus-within / data-open / data-invalid, the popover by data-trigger, the range cells by data-selection-start / -end.",
  tags: ["aria", "date", "styling", "css", "overlay"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/styles.css", "src/routes/index.tsx", "src/components/RangePickerParts.tsx"],
  test: [
    { attr: [".rv-DateRangePicker:has(#css-bad)", "data-invalid", "true"] },
    { expect: ["#css-bad-error", "Start date must be before end date."] },
    { matches: "#css-bad-error.rv-FieldError" },
    { click: "#css-button" },
    { attr: [".rv-DateRangePicker:has(#css)", "data-open", "true"] },
    { matches: '.rv-Popover[data-trigger="DateRangePicker"] .rv-RangeCalendar' },
    { matches: '.rv-CalendarCell[data-date="2026-10-14"][data-selection-start]' },
    { matches: '.rv-CalendarCell[data-date="2026-10-18"][data-selection-end]' },
    { key: "Escape" },
    { absent: ".rv-Popover" },
  ],
});
