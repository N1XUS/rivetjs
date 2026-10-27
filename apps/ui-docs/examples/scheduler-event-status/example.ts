import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scheduler: Unconfirmed and read-only events",
  summary:
    "A `data.status` marker from `renderEvent` draws unconfirmed events dashed on a clear chip; `isDraggable` / `isResizable` false lock one event (no grip, no drag) while it stays selectable.",
  tags: ["scheduler", "events"],
  status: "experimental",
  frame: { height: 640, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: '[data-rv-event-id="offsite"] [data-status="unconfirmed"]' },
    { attr: ['[data-rv-event-id="board"]', "data-draggable", "false"] },
    { absent: '[data-rv-event-id="board"] .rv-SchedulerEvent-resize-handle' },
    { press: ['[data-rv-event-id="board"]', "Enter"] },
    { expect: ["#selected", "Board meeting: confirmed, read-only"] },
    { press: ['[data-rv-event-id="offsite"]', "Enter"] },
    { expect: ["#selected", "Offsite (pending): unconfirmed"] },
  ],
});
