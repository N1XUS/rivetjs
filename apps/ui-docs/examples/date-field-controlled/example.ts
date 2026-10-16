import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateField: Controlled",
  summary: 'DateField demo "Controlled".',
  tags: ["date-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "text=Set today" },
    { expect: ["[data-slot=description]", "Current value: 20"] },
    { click: "text=Clear" },
    { expect: ["[data-slot=description]", "(empty)"] },
  ],
});
