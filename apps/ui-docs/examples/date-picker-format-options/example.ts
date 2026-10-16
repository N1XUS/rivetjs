import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DatePicker: Format Options",
  summary: 'DatePicker demo "Format Options".',
  tags: ["date-picker"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=select-trigger] >> nth=0" },
    { click: "[role=option][data-key=hour]" },
    { attr: ["[data-slot=date-picker] [data-type=hour]", "data-type", "hour"] },
    { click: "[data-slot=date-picker-trigger]" },
    { attr: ["[data-slot=date-picker-popover] [data-slot=time-field]", "data-slot", "time-field"] },
  ],
});
