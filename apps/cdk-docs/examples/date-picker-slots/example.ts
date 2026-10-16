import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DatePicker: content",
  summary:
    "Label and description take markup, the Button holds an icon or text, the Dialog any Calendar composition (two months); aria-label names a picker without a Label.",
  tags: ["aria", "date", "content"],
  status: "experimental",
  frame: { height: "xl" },
  show: ["src/routes/index.tsx", "src/styles.css", "src/components/Icon.tsx"],
  test: [
    { expect: ["#rich-label", "Check-in (required)"] },
    { described: ["#rich", "Times are local to the hotel."] },
    { matches: "#rich-button svg" },
    { attr: ["#rich-button", "aria-labelledby", "rich-button rich-label"] },
    { click: "#rich-button" },
    { matches: "#rich-dialog" },
    { focused: '[data-date="2026-10-14"]' },
    // Two grids: October and November.
    { expect: ["#rich-dialog", "November 2026"] },
    { matches: '#rich-dialog [data-date="2026-11-18"]' },
    { key: "Escape" },
    { absent: "#rich-dialog" },
    { expect: ["#bare-button", "Pick"] },
    { attr: ["#bare", "aria-label", "Reminder date"] },
    { name: ["#bare-field-month", "Reminder date"] },
    { click: "#bare-button" },
    { attr: ["#bare-dialog", "aria-labelledby", "bare-button bare"] },
    { key: "Escape" },
    { absent: "#bare-dialog" },
  ],
});
