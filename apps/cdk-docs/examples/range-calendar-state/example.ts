import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RangeCalendar: state functions",
  summary: "A part reads RangeCalendarStateContext: buttons call focusNextPage and clearSelection, rangeValue and selectedDateDescription read the range.",
  tags: ["cdk", "range-calendar", "state"],
  status: "experimental",
  frame: { height: 365, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#range", "class", "rv-RangeCalendar"] },
    { expect: ["#nights", "Nights: 4"] },
    { expect: ["#description", "Selected Range: Monday, October 5 to Friday, October 9, 2026"] },
    { click: '#range [data-date="2026-10-19"]' },
    { expect: ["#description", "No selection"] },
    { click: '#range [data-date="2026-10-26"]' },
    { expect: ["#nights", "Nights: 7"] },
    { expect: ["#description", "Selected Range: Monday, October 19 to Monday, October 26, 2026"] },
    { click: "#next" },
    { expect: ["#range .rv-Heading", "November 2026"] },
    { click: "#clear" },
    { expect: ["#nights", "Nights: 0"] },
    { expect: ["#description", "No selection"] },
    { attr: ['#range [data-date="2026-11-02"]', "data-selected", null] },
  ],
});
