import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateField: Tailwind",
  summary: "Tailwind utilities through class on each part; data-* variants and a render-prop class function (isPlaceholder) style the segments.",
  tags: ["aria", "date", "styling", "tailwind"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#tw-label", "class", "font-medium text-slate-700"] },
    { matches: "#tw-day.rounded.tabular-nums.text-slate-400" },
    { attr: ["#tw-day", "data-placeholder", "true"] },
    { press: ["#tw-day", "ArrowUp"] },
    { attr: ["#tw-day", "data-placeholder", null] },
    { attr: ["#tw-day", "aria-valuenow", "14"] },
    // The render-prop class function re-runs: no placeholder colour any more.
    { matches: "#tw-day.rounded:not(.text-slate-400)" },
    { attr: ["#tw-bad-day", "data-invalid", "true"] },
    { matches: ".group[data-invalid] #tw-bad" },
    { expect: ["#tw-bad-error", "Value must be 10/31/2026 or earlier."] },
    { matches: "#tw-bad-error.text-red-700" },
  ],
});
