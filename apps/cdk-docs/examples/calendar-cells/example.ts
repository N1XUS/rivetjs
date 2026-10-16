import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: cell render props",
  summary:
    "CalendarCell class and children as functions of the render props (formattedDate, date(), isSelected(), isOutsideMonth()): an event dot under some days.",
  tags: ["cdk", "calendar", "render-props"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ['#cal [data-date="2026-10-08"] .number', "8"] },
    { matches: '#cal [data-date="2026-10-08"] .dot' },
    { absent: '#cal [data-date="2026-10-09"] .dot' },
    { matches: '#cal [data-date="2026-10-14"].picked .dot.on' },
    { matches: '#cal [data-date="2026-09-27"].other' },
    { click: '#cal [data-date="2026-10-23"]' },
    { expect: ["#value", "Selected: 2026-10-23"] },
    { matches: '#cal [data-date="2026-10-23"].picked .dot.on' },
    { absent: '#cal [data-date="2026-10-14"].picked' },
    { matches: '#cal [data-date="2026-10-14"] .dot:not(.on)' },
  ],
});
