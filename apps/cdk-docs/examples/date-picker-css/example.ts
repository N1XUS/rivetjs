import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DatePicker: plain CSS",
  summary:
    "A stylesheet on .rv-DatePicker, .rv-Group, .rv-DateSegment, the .rv-Popover overlay and the .rv-Calendar* parts, with data-entering / data-exiting animations.",
  tags: ["aria", "date", "styling", "css", "overlay"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { attr: ["#css", "class", "rv-Group"] },
    { attr: ["#css-field", "class", "rv-DateInput"] },
    { attr: ["#css-button", "class", "rv-Button"] },
    { attr: ["#css-label", "class", "rv-Label"] },
    { click: "#css-button" },
    { matches: '.rv-Popover[data-trigger="DatePicker"]' },
    { attr: ["#css-button", "data-pressed", "true"] },
    { attr: [".rv-DatePicker", "data-open", "true"] },
    { attr: ["#css-dialog", "class", "rv-Dialog"] },
    { matches: '#css-dialog .rv-Calendar .rv-CalendarGrid .rv-CalendarCell[data-date="2026-10-14"][data-selected]' },
    { attr: ['[data-date="2026-10-01"]', "data-disabled", "true"] },
    { key: "Escape" },
    { absent: ".rv-Popover" },
    { attr: [".rv-DatePicker", "data-open", null] },
  ],
});
