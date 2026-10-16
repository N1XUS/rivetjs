import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateField: granularity",
  summary: "granularity picks the smallest segment (day, hour, minute, second), maxGranularity the largest; hourCycle forces 12 or 24 hours.",
  tags: ["aria", "date", "time"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Time segments are wrapped in bidi isolates: assert their values.
    { expect: ["#minute", "10/14/2026, "] },
    { attr: ["#minute-hour", "aria-valuenow", "9"] },
    { attr: ["#minute-minute", "aria-valuetext", "30"] },
    { attr: ["#minute-dayPeriod", "data-type", "dayPeriod"] },
    { attr: ["#hour-hour", "aria-valuetext", "9 AM"] },
    { absent: "#hour-minute" },
    { attr: ["#second-hour", "aria-valuenow", "21"] },
    { attr: ["#second-second", "aria-valuenow", "9"] },
    { absent: "#second-dayPeriod" },
    { attr: ["#empty-hour", "data-placeholder", "true"] },
    { expect: ["#empty-minute", "––"] },
    // The first ArrowUp on an empty segment shows the placeholder (08:00); the next one increments.
    { press: ["#empty-hour", "ArrowUp"] },
    { attr: ["#empty-hour", "aria-valuenow", "8"] },
    { key: "ArrowUp" },
    { attr: ["#empty-hour", "aria-valuenow", "9"] },
    { expect: ["#no-year", "10/14"] },
    { absent: "#no-year-year" },
    { attr: ["#time-only-hour", "aria-valuenow", "9"] },
    { absent: "#time-only-day" },
    // Typing "p" sets the day period.
    { press: ["#time-only-dayPeriod", "p"] },
    { attr: ["#time-only-hour", "aria-valuetext", "9 PM"] },
    { expect: ["#time-only-dayPeriod", "PM"] },
  ],
});
