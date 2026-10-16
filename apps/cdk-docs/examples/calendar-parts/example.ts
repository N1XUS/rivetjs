import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: composed parts",
  summary:
    "CalendarGrid children instead of a render function: CalendarGridHeader with CalendarHeaderCell, CalendarGridBody with CalendarCell; CalendarHeading with a format.",
  tags: ["cdk", "calendar", "parts"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#cal h2.rv-CalendarHeading", "Oct 26"] },
    { attr: ["#cal h2.rv-CalendarHeading", "aria-hidden", "true"] },
    { attr: ["#cal thead.rv-CalendarGridHeader", "aria-hidden", "true"] },
    { expect: ["#cal thead th.weekday:first-child", "Mon"] },
    { expect: ["#cal thead th.weekday:last-child", "Sun"] },
    { matches: '#cal tbody.days [data-date="2026-10-14"][data-selected]' },
    { click: '#cal [data-date="2026-10-22"]' },
    { expect: ["#value", "Selected: 2026-10-22"] },
    { click: '#cal [slot="next"]' },
    { expect: ["#cal h2.rv-CalendarHeading", "Nov 26"] },
    { attr: ["#cal table", "aria-label", "Meeting, November 2026"] },
  ],
});
