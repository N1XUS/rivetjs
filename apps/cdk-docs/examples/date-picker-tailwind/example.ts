import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DatePicker: Tailwind",
  summary:
    "Utilities on every part through class (strings or render-prop functions), group-data-[open] / aria-expanded / placement variants, entering / exiting animations.",
  tags: ["aria", "date", "styling", "tailwind", "overlay"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#tw.inline-flex.rounded-md" },
    { matches: ".group.grid:has(#tw)" },
    { attr: ["#tw-button", "aria-expanded", "false"] },
    { matches: "#tw-button svg" },
    { click: "#tw-button" },
    { matches: '[data-trigger="DatePicker"].rounded-lg' },
    { attr: ['[data-trigger="DatePicker"]', "data-placement", "bottom"] },
    { attr: [".group", "data-open", "true"] },
    { matches: '#tw-dialog [data-date="2026-10-14"][data-selected].bg-teal-600' },
    { focused: '[data-date="2026-10-14"]' },
    { key: "ArrowDown" },
    { focused: '[data-date="2026-10-21"]' },
    { key: "Enter" },
    { absent: "#tw-dialog" },
    { expect: ["#tw-field", "10/21/2026"] },
    { matches: "#tw-field-month:not(.text-slate-400)" },
  ],
});
