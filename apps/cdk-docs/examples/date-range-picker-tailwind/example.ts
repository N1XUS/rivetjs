import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateRangePicker: Tailwind",
  summary:
    "Tailwind utilities through class on each part: data-* and group-data-[open] variants, render-prop class functions for the button and the range cells.",
  tags: ["aria", "date", "styling", "tailwind", "overlay"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#tw.inline-flex.rounded-md" },
    { matches: "#tw-start-day.tabular-nums" },
    { press: ["#tw-start-day", "ArrowUp"] },
    { attr: ["#tw", "data-focus-visible", "true"] },
    { click: "#tw-button" },
    { attr: [".group", "data-open", "true"] },
    { matches: '.rounded-lg.shadow-lg[data-trigger="DateRangePicker"]' },
    { matches: '[data-date="2026-10-15"][data-selection-start].bg-teal-600.rounded-l-full' },
    { matches: '[data-date="2026-10-18"][data-selection-end].rounded-r-full' },
    { matches: '[data-date="2026-10-16"][data-selected].bg-teal-100' },
    { key: "Escape" },
    { absent: "#tw-dialog" },
  ],
});
