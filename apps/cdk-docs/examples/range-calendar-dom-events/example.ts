import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RangeCalendar: DOM events and attributes",
  summary: "RangeCalendar, Heading, CalendarGrid and CalendarCell take global DOM events and attributes; range selection keeps working underneath.",
  tags: ["cdk", "range-calendar", "dom-events"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#range", "dir", "ltr"] },
    { attr: ["#range .rv-Heading", "lang", "en"] },
    { attr: ["#range table", "translate", "no"] },
    { click: '#range [data-date="2026-10-12"]' },
    { expect: ["#log", "cell-up:2026-10-12"] },
    { expect: ["#log", "grid-click"] },
    { click: '#range [data-date="2026-10-15"]' },
    { expect: ["#log", "cell-up:2026-10-15"] },
    { expect: ["#value", "2026-10-12..2026-10-15"] },
    { dblclick: '#range [data-date="2026-10-20"]' },
    { expect: ["#log", "cell-dbl:2026-10-20"] },
    { expect: ["#log", "root-dbl"] },
  ],
});
