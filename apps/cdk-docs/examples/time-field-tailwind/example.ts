import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TimeField: Tailwind",
  summary: "Tailwind utilities through class on each part, data-* variants for the field state, and a render-prop class function on the segments.",
  tags: ["aria", "date", "time", "styling", "tailwind"],
  status: "experimental",
  frame: { height: 196, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#tw-label", "class", "font-medium text-slate-700"] },
    { matches: "#tw-hour.rounded.tabular-nums.text-slate-400" },
    { attr: ["#tw-hour", "data-placeholder", "true"] },
    { press: ["#tw-hour", "ArrowUp"] },
    { attr: ["#tw-hour", "data-placeholder", null] },
    { matches: "#tw-hour.rounded:not(.text-slate-400)" },
    { attr: ["#tw-hour", "aria-valuenow", "8"] },
    { attr: ["#tw-bad-hour", "data-invalid", "true"] },
    { matches: ".group[data-invalid] #tw-bad" },
    { expect: ["#tw-bad-error", "10:00 PM or earlier."] },
    { matches: "#tw-bad-error.text-red-700" },
  ],
});
