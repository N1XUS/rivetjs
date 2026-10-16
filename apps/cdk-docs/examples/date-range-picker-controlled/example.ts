import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateRangePicker: controlled",
  summary: "value ({ start, end } or null) and isOpen are signals; typing edits either end; defaultValue for an uncontrolled picker.",
  tags: ["aria", "date", "state", "overlay"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/components/RangePickerParts.tsx", "src/styles.css"],
  test: [
    { expect: ["#sprint-start", "10/12/2026"] },
    { expect: ["#trip-end", "1/3/2027"] },
    { click: "#next-week" },
    { expect: ["#sprint-end", "10/23/2026"] },
    { click: "#open" },
    { matches: "#sprint-dialog" },
    { matches: '#sprint-dialog [data-date="2026-10-19"][data-selection-start]' },
    { matches: '#sprint-dialog [data-date="2026-10-23"][data-selection-end]' },
    { click: '[data-date="2026-10-26"]' },
    { click: '[data-date="2026-10-28"]' },
    { absent: "#sprint-dialog" },
    { expect: ["#value", "Value: 2026-10-26 → 2026-10-28 · open: false"] },
    { press: ["#sprint-end-day", "ArrowDown"] },
    { expect: ["#value", "Value: 2026-10-26 → 2026-10-27"] },
    { click: "#clear" },
    { expect: ["#sprint-start", "mm/dd/yyyy"] },
  ],
});
