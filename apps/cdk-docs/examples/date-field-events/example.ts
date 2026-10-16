import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateField: events",
  summary: "onChange with a date object; onFocus / onBlur / onFocusChange fire once for the whole field; onKeyDown / onKeyUp for its keys.",
  tags: ["aria", "date", "events"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // The field handles the key first (onChange), then your onKeyDown runs.
    { press: ["#when-day", "ArrowUp"] },
    { expect: ["#log", "focus focusChange:true change:2026-10-15 keydown:ArrowUp keyup:ArrowUp"] },
    // Moving between segments stays inside the field: no blur / focus.
    { key: "ArrowRight" },
    { focused: "#when-year" },
    { expect: ["#log", "keyup:ArrowUp keydown:ArrowRight keyup:ArrowRight"] },
    { click: "#outside" },
    { expect: ["#log", "keyup:ArrowRight blur focusChange:false"] },
  ],
});
