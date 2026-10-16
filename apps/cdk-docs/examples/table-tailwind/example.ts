import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table with Tailwind",
  summary: "Render-prop classes on Table, Column (sortDirection), Row (isSelected, isFocusVisible) and Cell; a lucide chevron follows the sort direction.",
  tags: ["table", "styling", "tailwind"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#tracks-title.text-emerald-700" },
    { matches: "#tracks-title svg" },
    { expect: ["#tracks tbody tr:first-child", "Blue in Green"] },
    { click: "#tracks-naima-title" },
    { matches: "#tracks tr[data-key=naima].bg-emerald-600" },
    { matches: "#tracks tr[data-key=naima] td.tabular-nums:not(.text-slate-500)" },
    { click: "#tracks-title" },
    { matches: "#tracks-title svg.rotate-180" },
    { expect: ["#tracks tbody tr:first-child", "Take Five"] },
    // Down into the first body cell, Left to its row: keyboard focus shows the row ring.
    { key: "ArrowDown" },
    { focused: "#tracks-take5-title" },
    { key: "ArrowLeft" },
    { matches: "#tracks tr[data-key=take5].ring-2" },
  ],
});
