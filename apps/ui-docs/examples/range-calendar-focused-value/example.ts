import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RangeCalendar: Focused Value",
  summary: 'RangeCalendar demo "Focused Value".',
  tags: ["range-calendar"],
  status: "experimental",
  frame: { height: 436, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ click: "text=Go to Jan" }, { expect: ["[data-slot=range-calendar-heading]", "January 2025"] }],
});
