import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateRangePicker: Presets",
  summary: "Preset shortcuts update a two-way value signal inside the calendar popover.",
  tags: ["date-range-picker"],
  status: "experimental",
  frame: { height: 640 },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "[data-slot=date-range-picker-trigger]" },
    { matches: "[data-slot=date-range-picker-popover] [role=grid]" },
    { click: "#preset-week" },
    { expect: ["[data-slot=description]", "Current value: 20"] },
    { matches: '[role=grid] [data-selected="true"]' },
    { click: "#preset-month" },
    { expect: ["[data-slot=description]", "Current value: 20"] },
    { matches: '[role=grid] [data-selected="true"]' },
    { click: "#preset-this-month" },
    { expect: ["[data-slot=description]", "Current value: 20"] },
    { matches: '[role=grid] [data-selected="true"]' },
    { click: "#preset-this-year" },
    { expect: ["[data-slot=description]", "Current value: 20"] },
    { matches: '[role=grid] [data-selected="true"]' },
    { key: "Escape" },
    { absent: "[data-slot=date-range-picker-popover]" },
  ],
});
