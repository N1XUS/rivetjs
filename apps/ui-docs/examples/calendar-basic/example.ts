import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: Usage",
  summary: 'Calendar demo "Usage".',
  tags: ["calendar"],
  status: "experimental",
  frame: { height: 296, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["[data-slot=calendar-heading]", ""] },
    { click: "[data-slot=calendar-nav-button][slot=next]" },
    { expect: ["[data-slot=calendar-grid]", ""] },
  ],
});
