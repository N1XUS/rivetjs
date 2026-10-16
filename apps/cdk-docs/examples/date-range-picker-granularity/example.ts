import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateRangePicker: date-time ranges",
  summary: "granularity and hourCycle add time segments to both ends; zoned values with hideTimeZone and shouldForceLeadingZeros.",
  tags: ["aria", "date", "time"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/components/RangePickerParts.tsx", "src/styles.css"],
  test: [
    { attr: ["#shift-start-hour", "data-placeholder", "true"] },
    { absent: "#shift-start-dayPeriod" },
    { click: "#shift-button" },
    { click: '[data-date="2026-10-15"]' },
    { click: '[data-date="2026-10-16"]' },
    { absent: "#shift-dialog" },
    { expect: ["#value", "Value: 2026-10-15T09:00:00 → 2026-10-16T09:00:00"] },
    { press: ["#shift-end-hour", "End"] },
    { expect: ["#value", "→ 2026-10-16T23:00:00"] },
    { absent: "#flight-start-timeZoneName" },
    { expect: ["#flight-start", "10/14/2026"] },
    { attr: ["#flight-end-hour", "aria-valuetext", "1 PM"] },
    { expect: ["#flight-end-hour", "01"] },
  ],
});
