import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RangeCalendar: events",
  summary: "onFocusChange fires as focus (and the highlighted end) moves; onChange only when the range is complete, with CalendarDate objects.",
  tags: ["cdk", "range-calendar", "events"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: '#range [data-date="2026-10-12"]' },
    { expect: ["#log", "focus:2026-10-12"] },
    { click: '#range [data-date="2026-10-13"]' },
    { expect: ["#log", "focus:2026-10-13 change:2026-10-12..2026-10-13"] },
    { press: ['#range [data-date="2026-10-14"]', "Enter"] },
    { expect: ["#log", "focus:2026-10-15"] },
    { key: "ArrowRight" },
    { expect: ["#log", "focus:2026-10-15 focus:2026-10-16"] },
    { key: "Enter" },
    { expect: ["#log", "focus:2026-10-16 change:2026-10-14..2026-10-16"] },
  ],
});
