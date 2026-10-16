import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: Multiple Selection",
  summary: 'Calendar demo "Multiple Selection".',
  tags: ["calendar"],
  status: "experimental",
  frame: { height: 328, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=calendar-cell]:text-is('10')" },
    { click: "[data-slot=calendar-cell]:text-is('12')" },
    { expect: ["[data-slot=description]", "2 date(s) selected"] },
  ],
});
