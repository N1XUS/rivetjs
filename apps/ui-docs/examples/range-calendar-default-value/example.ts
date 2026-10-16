import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RangeCalendar: Default Value",
  summary: 'RangeCalendar demo "Default Value".',
  tags: ["range-calendar"],
  status: "experimental",
  frame: { height: 316, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["[data-selection-start=true]", ""] }],
});
