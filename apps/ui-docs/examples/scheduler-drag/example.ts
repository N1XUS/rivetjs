import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scheduler: Drag interactions",
  summary: "Move and resize a two-way event with the pointer or keyboard; accepted changes show their written-back string dates.",
  tags: ["scheduler", "drag"],
  status: "experimental",
  frame: {
    height: 640,
    auto: true,
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      press: ['[data-rv-event-id="planning"]', "Alt+ArrowDown"],
    },
    {
      expect: ["#drag-log", "Moved by keyboard: 2026-10-20T09:15"],
    },
    {
      press: ['[data-rv-event-id="planning"]', "Alt+Shift+ArrowDown"],
    },
    {
      expect: ["#drag-log", "Resized by keyboard: 2026-10-20T10:30"],
    },
  ],
});
