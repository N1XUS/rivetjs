import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scheduler: All-day events",
  summary: "Date-only strings place whole-day events in spanning lanes with an exclusive end.",
  tags: ["scheduler", "all-day"],
  status: "experimental",
  frame: {
    height: 640,
    auto: true,
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      press: ['[data-rv-event-id="summit"]', "Enter"],
    },
    {
      expect: ["#all-day-end", "2026-10-22 (exclusive)"],
    },
    {
      matches: '[data-rv-event-id="summit"][data-all-day="true"]',
    },
  ],
});
