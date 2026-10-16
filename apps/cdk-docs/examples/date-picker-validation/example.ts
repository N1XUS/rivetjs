import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DatePicker: validation",
  summary: "minValue / maxValue, isDateUnavailable and validate mark the picker invalid; FieldError children override the text; isInvalid forces the state.",
  tags: ["aria", "date", "forms", "validation"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: [".rv-DatePicker:has(#visit)", "data-invalid", "true"] },
    { attr: ["#visit", "data-invalid", "true"] },
    { attr: ["#visit-field-day", "aria-invalid", "true"] },
    { described: ["#visit", "Selected date unavailable."] },
    { described: ["#party", "Pick any day but the 13th."] },
    { described: ["#launch", "Launch in October at the earliest."] },
    { attr: ["#launch-error", "class", "rv-FieldError"] },
    { attr: ["#locked", "data-invalid", "true"] },
    { described: ["#locked", "This date is locked."] },
    // In the calendar, unavailable and out-of-range days cannot be picked.
    { click: "#visit-button" },
    { attr: ['[data-date="2026-10-18"]', "data-unavailable", "true"] },
    { key: "Escape" },
    { absent: "#visit-dialog" },
  ],
});
