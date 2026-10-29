import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scheduler: Event callbacks",
  summary: "onRangeSelect creates an event, onEventMove / onEventResize / onEventAction / onEventDelete report edits in a log.",
  tags: ["scheduler", "event-callbacks"],
  status: "experimental",
  frame: {
    height: 680,
    auto: true,
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      press: ['[data-rv-event-id="standup"]', "Alt+ArrowDown"],
    },
    {
      expect: ["#callback-log li:first-child", "onEventMove (keyboard): Standup starts 2026-10-20T09:30"],
    },
    {
      press: ['[data-rv-event-id="review"]', "Alt+Shift+ArrowDown"],
    },
    {
      expect: ["#callback-log li:first-child", "onEventResize (keyboard): Design review"],
    },
    {
      press: ['[data-rv-event-id="retro"]', "Enter"],
    },
    {
      expect: ["#callback-log li:first-child", "onEventAction: opened Retro"],
    },
    {
      press: ['[data-rv-event-id="retro"]', "Delete"],
    },
    {
      expect: ["#callback-log li:first-child", "onEventDelete: removed Retro"],
    },
    {
      absent: '[data-rv-event-id="retro"]',
    },
    {
      press: ['[data-rv-day-index="0"][data-rv-minutes="660"]', "Shift+ArrowDown"],
    },
    {
      key: "Enter",
    },
    {
      expect: ["#callback-log li:first-child", "onRangeSelect (keyboard): created new-1"],
    },
    {
      matches: '[data-rv-event-id="new-1"]',
    },
  ],
});
