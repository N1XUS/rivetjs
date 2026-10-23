import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scheduler: Move and resize vetoes",
  summary: "Read-only state, per-event drag/resize flags and a business-hours veto with visible accepted and rejected feedback.",
  tags: ["scheduler", "drag-vetoes"],
  status: "experimental",
  frame: {
    height: 640,
    auto: true,
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      press: ['[data-rv-event-id="business"]', "Alt+ArrowUp"],
    },
    {
      expect: ["#change-log", "Rejected:"],
    },
    {
      press: ['[data-rv-event-id="movable"]', "Alt+ArrowDown"],
    },
    {
      expect: ["#change-log", "Movable moved by keyboard: 2026-10-20T09:30"],
    },
    {
      press: ['[data-rv-event-id="movable"]', "Alt+Shift+ArrowDown"],
    },
    {
      expect: ["#change-log", "resized by keyboard"],
    },
    {
      click: "#read-only",
    },
    {
      expect: ["#read-only", "on"],
    },
    {
      absent: '[data-rv-event-id="movable"] [data-edge]',
    },
  ],
});
