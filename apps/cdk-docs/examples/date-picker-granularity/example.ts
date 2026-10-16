import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DatePicker: date and time",
  summary: "granularity adds time segments; a day picked in the calendar gets the placeholder time; hourCycle, zoned values, hideTimeZone, leading zeros.",
  tags: ["aria", "date", "time"],
  status: "experimental",
  frame: { height: "xl" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#meet-field-hour", "data-placeholder", "true"] },
    { click: "#meet-button" },
    // The picked day gets the placeholder time (09:00) and the popover closes.
    { click: '[data-date="2026-10-16"]' },
    { absent: "#meet-dialog" },
    { expect: ["#value", "Value: 2026-10-16T09:00:00"] },
    { attr: ["#meet-field-hour", "aria-valuenow", "9"] },
    { press: ["#meet-field-hour", "ArrowUp"] },
    { expect: ["#value", "Value: 2026-10-16T10:00:00"] },
    { attr: ["#h24-field-hour", "aria-valuenow", "21"] },
    { absent: "#h24-field-dayPeriod" },
    { attr: ["#h24-field-second", "aria-valuenow", "9"] },
    { expect: ["#zoned-field", "GMT+2"] },
    { absent: "#zoned-hidden-field-timeZoneName" },
    { expect: ["#zeros-field", "03/04/2026"] },
  ],
});
