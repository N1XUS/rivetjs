import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Select events",
  summary: "Every Select callback logged: onChange, onSelectionChange, onOpenChange, onFocus, onBlur, onFocusChange, onKeyDown and onKeyUp.",
  tags: ["select", "events"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    // Focus, open, then the key the trigger handled.
    { press: ["#ev-trigger", "ArrowDown"] },
    { focused: "#ev-listbox-option-cat" },
    { expect: ["#log", "focus focused:true open:true down:ArrowDown"] },
    // Selecting: onChange, then the deprecated onSelectionChange, then the close.
    { key: "ArrowDown" },
    { key: "Enter" },
    { absent: "#ev-listbox" },
    { expect: ["#log", "change:dog selection:dog open:false"] },
    { focused: "#ev-trigger" },
    // Keys on the trigger reach onKeyDown / onKeyUp.
    { press: ["#ev-trigger", "Shift"] },
    { expect: ["#log", "down:Shift up:Shift"] },
    // Tab away: onBlur, onFocusChange(false).
    { key: "Tab" },
    { focused: "#ev-after" },
    { expect: ["#log", "up:Shift down:Tab blur focused:false"] },
    // A mouse choice of the same value: no change event, the popover still closes.
    { click: "#ev-trigger" },
    { click: "#ev-listbox-option-dog" },
    { absent: "#ev-listbox" },
    { focused: "#ev-trigger" },
  ],
});
