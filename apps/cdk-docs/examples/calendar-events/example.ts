import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: events",
  summary: "onChange fires with the selected CalendarDate, onFocusChange with every newly focused date (arrows, paging, presses).",
  tags: ["cdk", "calendar", "events"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Keyboard first on the resumed page: focus stays on the cells across a page change.
    { press: ['#cal [data-date="2026-10-14"]', "ArrowRight"] },
    { expect: ["#log", "focus:2026-10-15"] },
    { focused: '#cal [data-date="2026-10-15"]' },
    { key: "PageDown" },
    { expect: ["#log", "focus:2026-10-15 focus:2026-11-15"] },
    { focused: '#cal [data-date="2026-11-15"]' },
    { key: "PageUp" },
    { focused: '#cal [data-date="2026-10-15"]' },
    { click: '#cal [data-date="2026-10-20"]' },
    { expect: ["#log", "change:2026-10-20 focus:2026-10-20"] },
    { press: ['#cal [data-date="2026-10-20"]', "ArrowRight"] },
    { expect: ["#log", "focus:2026-10-20 focus:2026-10-21"] },
    { key: "PageDown" },
    { expect: ["#log", "focus:2026-10-21 focus:2026-11-21"] },
    { key: "Enter" },
    { expect: ["#log", "focus:2026-11-21 change:2026-11-21"] },
  ],
});
