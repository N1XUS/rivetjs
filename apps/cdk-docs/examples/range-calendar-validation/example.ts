import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RangeCalendar: validation",
  summary: "minValue, booked days and a one-week limit from the anchor (isDateUnavailable's second argument); an invalid range shows the errorMessage Text.",
  tags: ["cdk", "range-calendar", "validation"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // The initial range ends on a booked day.
    { attr: ["#trip", "data-invalid", "true"] },
    { attr: ['#trip [data-date="2026-10-16"]', "data-unavailable", "true"] },
    { attr: ['#trip [data-date="2026-10-14"]', "data-invalid", "true"] },
    { described: ['#trip [data-date="2026-10-14"]', "are booked"] },
    { attr: ['#trip [data-date="2026-10-02"]', "aria-disabled", "true"] },
    // Anchored on the 4th: the 12th lies more than a week away.
    { click: '#trip [data-date="2026-10-04"]' },
    { attr: ['#trip [data-date="2026-10-11"]', "data-unavailable", null] },
    { attr: ['#trip [data-date="2026-10-12"]', "data-unavailable", "true"] },
    { click: '#trip [data-date="2026-10-10"]' },
    { expect: ["#value", "2026-10-04 → 2026-10-10"] },
    { attr: ["#trip", "data-invalid", null] },
    // No anchor: the far days are available again.
    { attr: ['#trip [data-date="2026-10-12"]', "data-unavailable", null] },
  ],
});
