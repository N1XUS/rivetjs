import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RangeCalendar: plain CSS",
  summary: "A stylesheet on rv-CalendarCell: data-selected fills the range, data-selection-start / -end round its ends, the selection preview reuses them.",
  tags: ["cdk", "range-calendar", "css"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: '#range.rv-RangeCalendar .rv-CalendarGrid .rv-CalendarCell[data-date="2026-10-12"][data-selection-start]' },
    { matches: '#range .rv-CalendarCell[data-date="2026-10-16"][data-selection-end]' },
    { matches: '#range .rv-CalendarCell[data-date="2026-10-22"][data-unavailable]' },
    { matches: "#range .rv-CalendarHeaderCell" },
    // While selecting, the start cell and the focused end preview the range.
    { press: ['#range [data-date="2026-10-19"]', "Enter"] },
    { focused: '#range [data-date="2026-10-20"]' },
    { key: "ArrowRight" },
    { attr: ['#range [data-date="2026-10-19"]', "data-selection-start", "true"] },
    { attr: ['#range [data-date="2026-10-21"]', "data-selection-end", "true"] },
    { attr: ['#range [data-date="2026-10-14"]', "data-selected", null] },
    // Past the unavailable 22nd nothing is reachable.
    { attr: ['#range [data-date="2026-10-23"]', "aria-disabled", "true"] },
    { key: "Enter" },
    { attr: ['#range [data-date="2026-10-20"]', "data-selected", "true"] },
    { attr: ['#range [data-date="2026-10-21"]', "data-selection-end", "true"] },
    { attr: ['#range [data-date="2026-10-23"]', "aria-disabled", null] },
  ],
});
