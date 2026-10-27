import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scheduler: Spanning events and date navigation",
  summary:
    "Multi-day events span the month rows and split at week boundaries; activating a day (click, Enter or Space) opens it in the day view through the two-way `view` / `date` signals.",
  tags: ["scheduler", "month", "navigation"],
  status: "experimental",
  frame: { height: 640, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: '[data-rv-event-id="sprint"][data-continues-after]' },
    { matches: '[data-rv-event-id="sprint"][data-continues-before]' },
    { press: ['.rv-SchedulerMonth-cell[data-rv-day-index="24"]', "Space"] },
    { expect: ["#nav", "day · 2026-10-22"] },
    { matches: '[data-rv-event-id="demo"]' },
    { click: "#back-to-month" },
    { expect: ["#nav", "month"] },
  ],
});
