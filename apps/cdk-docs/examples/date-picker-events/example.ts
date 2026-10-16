import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DatePicker: events",
  summary: "onChange, onOpenChange, and the group's onFocus / onBlur / onFocusChange / onKeyDown / onKeyUp (not while the calendar is open).",
  tags: ["aria", "date", "events"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Alt+ArrowDown on a segment opens the calendar (the picker handles it; onKeyDown sees only the Alt key).
    { press: ["#ev-field-day", "Alt+ArrowDown"] },
    { matches: "#ev-dialog" },
    { expect: ["#log", "focus focusChange:true keydown:Alt open:true"] },
    { focused: '[data-date="2026-10-14"]' },
    { key: "ArrowDown" },
    { focused: '[data-date="2026-10-21"]' },
    { key: "Enter" },
    { absent: "#ev-dialog" },
    { expect: ["#log", "change:2026-10-21 open:false"] },
    // Focus returns where it was when the calendar opened; no blur while it was in the calendar.
    { focused: "#ev-field-day" },
    { key: "ArrowUp" },
    { expect: ["#log", "change:2026-10-22 keydown:ArrowUp keyup:ArrowUp"] },
    // After a typed change: the next pick also returns focus, and no second focus event fires on close.
    { key: "Alt+ArrowDown" },
    { matches: "#ev-dialog" },
    { focused: '[data-date="2026-10-22"]' },
    { key: "ArrowRight" },
    { key: "Enter" },
    { absent: "#ev-dialog" },
    { focused: "#ev-field-day" },
    { expect: ["#log", "change:2026-10-23 open:false"] },
    { click: "#outside" },
    { expect: ["#log", "change:2026-10-23 open:false blur focusChange:false"] },
  ],
});
