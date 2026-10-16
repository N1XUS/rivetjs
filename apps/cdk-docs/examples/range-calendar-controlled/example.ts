import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RangeCalendar: controlled",
  summary: "The range and the focused date are two-way signals: buttons set or clear the range and move focus, the calendar writes both back.",
  tags: ["cdk", "range-calendar", "signals"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#value", "Stay: none"] },
    { click: "#weekend" },
    { attr: ['#stay [data-date="2026-10-17"]', "data-selection-start", "true"] },
    { attr: ['#stay [data-date="2026-10-18"]', "data-selection-end", "true"] },
    { click: "#week" },
    { attr: ['#stay [data-date="2026-10-21"]', "data-selected", "true"] },
    { attr: ['#stay [data-date="2026-10-17"]', "data-selected", null] },
    { click: "#focus-21" },
    { attr: ['#stay [data-date="2026-10-21"]', "tabindex", "0"] },
    { click: '#stay [data-date="2026-10-02"]' },
    { expect: ["#focused", "Focused: 2026-10-02"] },
    { click: '#stay [data-date="2026-10-06"]' },
    { expect: ["#value", "Stay: 2026-10-02 to 2026-10-06"] },
    { click: "#clear" },
    { expect: ["#value", "Stay: none"] },
    { attr: ['#stay [data-date="2026-10-04"]', "data-selected", null] },
  ],
});
