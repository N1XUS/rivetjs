import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateField: Granularity",
  summary: 'DateField demo "Granularity".',
  tags: ["date-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=select-trigger]" },
    { click: "[role=option][data-key=hour]" },
    { expect: ["[data-type=hour]", "8"] },
    { click: "[data-slot=select-trigger]" },
    { click: "[role=option][data-key=day]" },
    { expect: ["[data-type=day]", "3"] },
  ],
});
