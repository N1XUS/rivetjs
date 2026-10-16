import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RangeCalendar: month and year pickers",
  summary: "CalendarMonthPicker and CalendarYearPicker hand { aria-label, value(), onChange, items() } to a select; picking moves the visible month.",
  tags: ["cdk", "range-calendar", "pickers"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#month", "aria-label", "month"] },
    { attr: ["#year", "aria-label", "year"] },
    { attr: ['#month option[value="10"]', "selected", ""] },
    { expect: ['#month option[value="10"]', "Oct"] },
    { expect: ["#year option[selected]", "2026"] },
    { attr: ['#range [data-date="2026-10-12"]', "data-selection-start", "true"] },
    // Linux headless-shell needs navigation keys; macOS native selects support type-ahead instead.
    { press: ["#month", process.platform === "linux" ? "End" : "d"] },
    { attr: ["#range", "aria-label", "Project, December 2026"] },
    { matches: '#range [data-date="2026-12-15"]' },
    { press: ["#year", process.platform === "linux" ? "ArrowDown" : "2"] },
    { attr: ["#range", "aria-label", "Project, December 2027"] },
    // Paging updates the pickers.
    { click: '#range button[aria-label="Next"]' },
    { attr: ["#range", "aria-label", "Project, January 2028"] },
    { attr: ['#month option[value="1"]', "selected", ""] },
    { expect: ["#year option[selected]", "2028"] },
    { expect: ["#value", "2026-10-12 → 2026-10-16"] },
  ],
});
