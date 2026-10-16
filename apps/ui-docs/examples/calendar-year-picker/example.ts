import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: Year Picker",
  summary: 'Calendar demo "Year Picker".',
  tags: ["calendar"],
  status: "experimental",
  frame: { height: 296, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=calendar-year-picker-trigger]" },
    { expect: ["[data-slot=calendar-year-picker-year-cell][aria-selected=true]", ""] },
    { key: "Escape" },
  ],
});
