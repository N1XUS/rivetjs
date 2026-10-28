import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DatePicker: Presets",
  summary: "Preset shortcuts update a two-way value signal inside the calendar popover.",
  tags: ["date-picker"],
  status: "experimental",
  frame: { height: 640 },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "[data-slot=date-picker-trigger]" },
    { matches: "[data-slot=date-picker-popover] [role=grid]" },
    { click: "#preset-today" },
    { expect: ["[data-slot=description]", "Current value: 20"] },
    { matches: '[role=grid] [data-selected="true"]' },
    { click: "#preset-tomorrow" },
    { expect: ["[data-slot=description]", "Current value: 20"] },
    { matches: '[role=grid] [data-selected="true"]' },
    { click: "#preset-next-week" },
    { expect: ["[data-slot=description]", "Current value: 20"] },
    { matches: '[role=grid] [data-selected="true"]' },
    { key: "Escape" },
    { absent: "[data-slot=date-picker-popover]" },
  ],
});
