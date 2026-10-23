import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scheduler: Month view features",
  summary: "ISO week numbers, a server-determined lane cap and an interactive overflow panel keep a busy month readable.",
  tags: ["scheduler", "month-features"],
  status: "experimental",
  frame: {
    height: 640,
    auto: true,
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: '[data-rv-day-index="22"] [data-rv-more]',
    },
    {
      expect: ["#overflow", "Hidden events:"],
    },
    {
      matches: ".rv-SchedulerMonth-popover [data-rv-event-id]",
    },
    {
      key: "Escape",
    },
    {
      absent: ".rv-SchedulerMonth-popover",
    },
  ],
});
