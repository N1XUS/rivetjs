import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TimeField: format options",
  summary: "granularity, hourCycle, locale, shouldForceLeadingZeros, zoned values with hideTimeZone, and placeholderValue for an empty field.",
  tags: ["aria", "date", "time", "i18n"],
  status: "experimental",
  frame: { height: 548, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#hour-hour", "aria-valuetext", "9 AM"] },
    { absent: "#hour-minute" },
    { attr: ["#second-second", "aria-valuenow", "15"] },
    { attr: ["#h24-hour", "aria-valuenow", "21"] },
    { absent: "#h24-dayPeriod" },
    { attr: ["#de-hour", "aria-valuenow", "21"] },
    { attr: ["#de-hour", "aria-label", "Stunde, "] },
    { expect: ["#zeros-hour", "09"] },
    { attr: ["#zoned-timeZoneName", "data-type", "timeZoneName"] },
    { expect: ["#zoned", "PDT"] },
    { absent: "#zoned-hidden-timeZoneName" },
    { attr: ["#zoned-hidden-hour", "aria-valuetext", "5 PM"] },
    { attr: ["#empty-hour", "data-placeholder", "true"] },
    // The first ArrowUp on an empty segment shows the placeholder hour; the next one increments.
    { press: ["#empty-hour", "ArrowUp"] },
    { attr: ["#empty-hour", "aria-valuenow", "8"] },
    { key: "ArrowUp" },
    { attr: ["#empty-hour", "aria-valuenow", "9"] },
  ],
});
