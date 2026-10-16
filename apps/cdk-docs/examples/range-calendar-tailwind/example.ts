import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RangeCalendar: Tailwind",
  summary: "Two months with CalendarHeading / CalendarGrid offsets; CalendarCell class render props pick fills and logical radii, data-[…] variants the rest.",
  tags: ["cdk", "range-calendar", "tailwind"],
  status: "experimental",
  frame: { height: 334, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#range.rounded-2xl .month header > h2.text-sm" },
    { expect: ["#range .month:nth-child(2) h2", "November 2026"] },
    { matches: '#range [data-date="2026-10-12"].rounded-s-full.bg-sky-600[data-selection-start]' },
    { matches: '#range [data-date="2026-10-14"].bg-sky-100[data-selected]' },
    { matches: '#range [data-date="2026-10-16"].rounded-e-full' },
    // A click anchors the range, the keyboard completes it.
    { click: '#range .month:nth-child(2) [data-date="2026-11-03"]' },
    { expect: ["#value", "2026-10-12 → 2026-10-16"] },
    { focused: '#range .month:nth-child(2) [data-date="2026-11-03"]' },
    { key: "ArrowDown" },
    { focused: '#range .month:nth-child(2) [data-date="2026-11-10"]' },
    { key: "Enter" },
    { expect: ["#value", "2026-11-03 → 2026-11-10"] },
    { matches: '#range [data-date="2026-11-03"].rounded-s-full' },
    { matches: '#range [data-date="2026-11-06"].bg-sky-100' },
    { matches: '#range [data-date="2026-10-14"].rounded-full' },
  ],
});
