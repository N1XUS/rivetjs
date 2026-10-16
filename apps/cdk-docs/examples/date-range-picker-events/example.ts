import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateRangePicker: events",
  summary: "onChange with a range of date objects, onOpenChange, and focus / key events of the whole group (moving between the two fields fires none).",
  tags: ["aria", "date", "events"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/components/RangePickerParts.tsx", "src/styles.css"],
  test: [
    { press: ["#ev-end-day", "ArrowUp"] },
    { expect: ["#log", "focus focusChange:true change:2026-10-14..2026-10-17 keydown:ArrowUp keyup:ArrowUp"] },
    // From the end field into the start field: still inside the group, no blur / focus.
    { key: "ArrowLeft" },
    { key: "ArrowLeft" },
    { focused: "#ev-start-year" },
    { expect: ["#log", "keyup:ArrowUp keydown:ArrowLeft keyup:ArrowLeft keydown:ArrowLeft keyup:ArrowLeft"] },
    { click: "#ev-button" },
    { expect: ["#log", "open:true"] },
    { click: '[data-date="2026-10-20"]' },
    { click: '[data-date="2026-10-22"]' },
    { absent: "#ev-dialog" },
    { expect: ["#log", "change:2026-10-20..2026-10-22 open:false"] },
    { click: "#outside" },
    { expect: ["#log", "blur focusChange:false"] },
  ],
});
