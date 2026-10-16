import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: month and year pickers",
  summary:
    "CalendarMonthPicker and CalendarYearPicker hand a picker's aria-label, value(), onChange and items() to a render function: here two native selects.",
  tags: ["cdk", "calendar", "pickers"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#month", "aria-label", "month"] },
    { attr: ["#year", "aria-label", "year"] },
    { matches: '#month option[value="10"]:checked' },
    { expect: ["#year option:checked", "2026"] },
    { expect: ["#year option:first-child", "2021"] },
    // Type-ahead in the native selects: "m" picks March, "2" the next year (2027).
    { press: ["#month", "m"] },
    { attr: ["#cal table", "aria-label", "Birthday, March 2026"] },
    { attr: ['#cal [data-date="2026-03-14"]', "tabindex", "0"] },
    { press: ["#year", "2"] },
    { attr: ["#cal table", "aria-label", "Birthday, March 2027"] },
    { expect: ["#year option:checked", "2027"] },
    // The years re-centre on the focused one.
    { expect: ["#year option:first-child", "2022"] },
    { click: '#cal [slot="next"]' },
    { matches: '#month option[value="4"]:checked' },
    { click: '#cal [data-date="2027-04-02"]' },
    { expect: ["#value", "Selected: 2027-04-02"] },
  ],
});
