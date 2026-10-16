import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Calendar: Tailwind",
  summary:
    "Utilities on every part through class: strings with data-[…]: variants, or functions of the render props (isSelected(), isDisabled(), isInvalid()).",
  tags: ["cdk", "calendar", "tailwind"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#cal.rounded-xl.border-slate-200" },
    { matches: "#cal header h2.font-semibold" },
    { matches: '#cal [data-date="2026-10-14"].bg-indigo-600[data-selected]' },
    { matches: '#cal [data-date="2026-10-18"].text-slate-300[data-unavailable]' },
    { absent: "#cal .rv-CalendarCell" },
    { click: '#cal [data-date="2026-10-21"]' },
    { expect: ["#value", "2026-10-21"] },
    { matches: '#cal [data-date="2026-10-21"].bg-indigo-600' },
    { absent: '#cal [data-date="2026-10-14"].bg-indigo-600' },
    { press: ['#cal [data-date="2026-10-21"]', "ArrowRight"] },
    { attr: ['#cal [data-date="2026-10-22"]', "data-focus-visible", "true"] },
  ],
});
