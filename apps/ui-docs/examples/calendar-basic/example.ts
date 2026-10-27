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
    // The next month is shown (today's cell left the grid) and the compound parts kept their markup (icons, slots).
    { absent: "[data-slot=calendar-cell][data-today]:not([data-outside-month])" },
    { matches: "[data-slot=calendar-nav-button-icon]" },
  ],
});
