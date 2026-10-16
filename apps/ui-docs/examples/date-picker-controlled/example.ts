import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DatePicker: Controlled",
  summary: 'DatePicker demo "Controlled".',
  tags: ["date-picker"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "text=Clear" },
    { expect: ["[data-slot=description]", "(empty)"] },
    { click: "text=Set today" },
    { expect: ["[data-slot=description]", "Current value: 20"] },
  ],
});
