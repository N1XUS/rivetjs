import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: events",
  summary: "`onChange`, `onSubmit` (Enter), `onClear` (Escape or the clear button) and focus events logged as they fire.",
  tags: ["search-field", "events"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { fill: ["#q", "menu"] },
    { expect: ["#log", "change: menu"] },
    { expect: ["#log", "focus: true"] },
    { press: ["#q", "Enter"] },
    { expect: ["#log", "submit: menu"] },
    { key: "Escape" },
    { expect: ["#log", "clear"] },
    { attr: ["#q", "value", ""] },
    { fill: ["#q", "tabs"] },
    { click: 'button[aria-label="Clear search"]' },
    { attr: ["#q", "value", ""] },
    { focused: "#q" },
  ],
});
