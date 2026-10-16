import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: plain CSS",
  summary:
    "A stylesheet on the default part classes (rv-Calendar, rv-CalendarGrid, rv-CalendarCell, …) and the data-* states: hovered, pressed, focus-visible, today, selected, unavailable, outside-month.",
  tags: ["cdk", "calendar", "css"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: "#cal.rv-Calendar > header > .rv-Heading" },
    { matches: "#cal header > button.rv-Button[slot=previous] svg" },
    { matches: "#cal table.rv-CalendarGrid > thead.rv-CalendarGridHeader th.rv-CalendarHeaderCell" },
    { matches: '#cal tbody.rv-CalendarGridBody td[role="gridcell"] > .rv-CalendarCell[data-date="2026-10-14"][data-selected]' },
    { matches: '#cal .rv-CalendarCell[data-date="2026-10-16"][data-unavailable]' },
    { matches: '#cal .rv-CalendarCell[data-date="2026-10-02"][aria-disabled="true"]' },
    { click: '#cal [data-date="2026-10-20"]' },
    { attr: ['#cal [data-date="2026-10-20"]', "data-selected", "true"] },
    { attr: ['#cal [data-date="2026-10-20"]', "data-hovered", "true"] },
  ],
});
