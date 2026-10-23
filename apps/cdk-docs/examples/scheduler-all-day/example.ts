import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scheduler: All-day spans and midnight crossings",
  summary: "Whole-day spans, a 36-hour lane event and a shorter midnight-crossing timed event share a week.",
  tags: ["scheduler", "all-day-spans"],
  status: "experimental",
  frame: {
    height: 640,
    auto: true,
  },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    {
      press: ['[data-rv-event-id="conference"]', "Enter"],
    },
    {
      expect: ["#opened", "2026-10-22 (exclusive)"],
    },
    {
      matches: '[data-rv-event-id="offsite"][data-all-day="true"]',
    },
    {
      matches: '[data-rv-event-id="launch"][data-timed="true"]',
    },
  ],
});
