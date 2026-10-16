import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RangeCalendar: Controlled",
  summary: 'RangeCalendar demo "Controlled".',
  tags: ["range-calendar"],
  status: "experimental",
  frame: { height: 448, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "text=Set Holidays" },
    { expect: ["[data-slot=description]", "Selected range: 2025-12-20 -> 2025-12-31"] },
    { click: "text=Clear" },
    { expect: ["[data-slot=description]", "(none)"] },
  ],
});
