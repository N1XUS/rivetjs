import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TimeField: validation",
  summary: "minValue / maxValue and validate produce errors shown by FieldError; isInvalid forces the invalid state; fixing the value clears the error.",
  tags: ["aria", "date", "time", "forms", "validation"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: [".rv-TimeField:has(#visit)", "data-invalid", "true"] },
    { attr: ["#visit-hour", "aria-invalid", "true"] },
    // RAC (useTimeFieldState maxGranularity "hour"): the bound is formatted as a time only.
    { described: ["#visit", "Value must be 5:00 PM or earlier."] },
    { described: ["#slot", "Appointments start every 15 minutes."] },
    { described: ["#flagged", "Already booked."] },
    { attr: ["#flagged-minute", "aria-invalid", "true"] },
    // 6:30 PM → 4:30 PM: inside the range, the error goes away.
    { press: ["#visit-hour", "ArrowDown"] },
    { key: "ArrowDown" },
    { attr: ["#visit-hour", "aria-valuetext", "4 PM"] },
    { attr: ["#visit-hour", "aria-invalid", null] },
    { absent: "#visit-error" },
  ],
});
