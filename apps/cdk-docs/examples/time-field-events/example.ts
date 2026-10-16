import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TimeField: events",
  summary: "onChange (a Time), onFocus / onBlur / onFocusChange for the whole field, onKeyDown / onKeyUp after the field handled the key.",
  tags: ["aria", "date", "time", "events"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    // The field handles the key first (onChange), then your onKeyDown runs.
    { press: ["#at-minute", "ArrowUp"] },
    { expect: ["#log", "focus focusChange:true change:09:31:00 keydown:ArrowUp keyup:ArrowUp"] },
    // Moving between segments stays inside the field: no blur / focus.
    { key: "ArrowRight" },
    { focused: "#at-dayPeriod" },
    { expect: ["#log", "keyup:ArrowUp keydown:ArrowRight keyup:ArrowRight"] },
    { click: "#outside" },
    { expect: ["#log", "keyup:ArrowRight blur focusChange:false"] },
  ],
});
