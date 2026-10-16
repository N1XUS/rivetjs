import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateRangePicker: Controlled",
  summary: 'DateRangePicker demo "Controlled".',
  tags: ["date-range-picker"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "text=Clear" },
    { expect: ["[data-slot=description]", "(empty)"] },
    { click: "text=Set week" },
    { expect: ["[data-slot=description]", " -> 20"] },
  ],
});
