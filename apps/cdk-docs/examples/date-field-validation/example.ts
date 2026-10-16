import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateField: validation",
  summary: "isDateUnavailable, minValue / maxValue and validate produce errors; FieldError children override the text; isInvalid forces the state.",
  tags: ["aria", "date", "forms", "validation"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: [".rv-DateField:has(#checkin)", "data-invalid", "true"] },
    { attr: ["#checkin-month", "aria-invalid", "true"] },
    { described: ["#checkin", "Selected date unavailable."] },
    { described: ["#checkout", "Value must be 10/31/2026 or earlier."] },
    { attr: ["#checkout-day", "data-invalid", "true"] },
    { described: ["#party", "Pick any day but the 13th."] },
    { described: ["#return", "Too early: October at the earliest."] },
    { described: ["#flagged", "Flagged by the server."] },
    { attr: ["#flagged-year", "aria-invalid", "true"] },
    { attr: ["#flagged-error", "class", "rv-FieldError"] },
  ],
});
