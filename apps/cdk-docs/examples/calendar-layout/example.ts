import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: first weekday, weeks per month, weekday style",
  summary: "firstDayOfWeek overrides the locale's week start, weeksInMonth fixes the row count, CalendarGrid weekdayStyle picks narrow, short or long names.",
  tags: ["cdk", "calendar", "layout"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#mon thead th:first-child", "Mon"] },
    { expect: ["#mon thead th:last-child", "Sun"] },
    { expect: ["#mon tbody tr:first-child td:nth-child(4)", "1"] },
    { expect: ["#six thead th:first-child", "Sunday"] },
    // February 2026 fits in four rows; weeksInMonth renders six.
    { matches: "#six tbody tr:nth-child(6)" },
    { absent: "#six tbody tr:nth-child(7)" },
    { attr: ['#six [data-date="2026-03-14"]', "data-outside-month", "true"] },
    { click: '#six [slot="next"]' },
    { expect: ["#six .rv-Heading", "March 2026"] },
    { matches: "#six tbody tr:nth-child(6)" },
    { absent: "#six tbody tr:nth-child(7)" },
  ],
});
